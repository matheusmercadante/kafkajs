const Broker = require('./index')
const { secureRandom, createConnection } = require('testHelpers')

describe('Broker > Heartbeat', () => {
  let topicName, groupId, seedBroker, broker, groupCoordinator

  beforeEach(async () => {
    topicName = `test-topic-${secureRandom()}`
    groupId = `consumer-group-id-${secureRandom()}`

    seedBroker = new Broker(createConnection())
    await seedBroker.connect()

    const metadata = await seedBroker.metadata([topicName])
    // Find leader of partition
    const partitionBroker = metadata.topicMetadata[0].partitionMetadata[0].leader
    const newBrokerData = metadata.brokers.find(b => b.nodeId === partitionBroker)

    // Connect to the correct broker to produce message
    broker = new Broker(createConnection(newBrokerData))
    await broker.connect()

    const { coordinator: { host, port } } = await seedBroker.findGroupCoordinator({ groupId })
    groupCoordinator = new Broker(createConnection({ host, port }))
    await groupCoordinator.connect()
  })

  afterEach(async () => {
    await seedBroker.disconnect()
    await broker.disconnect()
    await groupCoordinator.disconnect()
  })

  test('request', async () => {
    const { generationId, memberId } = await groupCoordinator.joinGroup({
      groupId,
      sessionTimeout: 30000,
    })

    const groupAssignment = [
      {
        memberId,
        memberAssignment: { [topicName]: [0] },
      },
    ]

    await groupCoordinator.syncGroup({
      groupId,
      generationId,
      memberId,
      groupAssignment,
    })

    const response = await groupCoordinator.heartbeat({
      groupId,
      groupGenerationId: generationId,
      memberId,
    })

    expect(response).toEqual({ errorCode: 0 })
  })
})
