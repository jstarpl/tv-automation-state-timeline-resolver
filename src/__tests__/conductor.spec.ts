import { TriggerType } from 'superfly-timeline'

import {
	Mappings,
	MappingAbstract,
	DeviceType
} from '../types/src'
import { Conductor, TimelineTriggerTimeResult, TimelineContentObject } from '../conductor'
import * as _ from 'underscore'
import { MockTime } from './mockTime.spec'
import { ThreadedClass } from 'threadedclass'
import { AbstractDevice } from '../devices/abstract'

// let nowActual: number = Date.now()
// process.on('unhandledRejection', (reason, p) => {
// 	setTimeout(() => {
// 		console.log('Unhandled Rejection at: Promise' + p + 'reason:' + reason.stack)
// 	},10)
// 	console.log('Unhandled Rejection at: Promise' + p + 'reason:' + reason.stack)
// })

describe('Conductor', () => {
	let mockTime = new MockTime()
	beforeAll(() => {
		mockTime.mockDateNow()
	})
	beforeEach(() => {
		mockTime.init()
	})
	test('Test Abstract-device functionality', async () => {

		let commandReceiver0 = jest.fn(() => {
			return Promise.resolve()
		})
		let commandReceiver1 = jest.fn(() => {
			return Promise.resolve()
		})

		let myLayerMapping0: MappingAbstract = {
			device: DeviceType.ABSTRACT,
			deviceId: 'device0'
		}
		let myLayerMapping1: MappingAbstract = {
			device: DeviceType.ABSTRACT,
			deviceId: 'device1'
		}
		let myLayerMapping: Mappings = {
			'myLayer0': myLayerMapping0,
			'myLayer1': myLayerMapping1
		}

		let conductor = new Conductor({
			initializeAsClear: true,
			getCurrentTime: mockTime.getCurrentTime
		})

		await conductor.setMapping(myLayerMapping)
		await conductor.init()
		await conductor.addDevice('device0', {
			type: DeviceType.ABSTRACT,
			options: {
				commandReceiver: commandReceiver0
			}
		})
		await conductor.addDevice('device1', {
			type: DeviceType.ABSTRACT,
			options: {
				commandReceiver: commandReceiver1
			}
		})

		// add something that will play in a seconds time
		let abstractThing0: TimelineContentObject = {
			id: 'a0',
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: mockTime.now
			},
			duration: 1000,
			LLayer: 'myLayer0',
			content: {
				myAttr1: 'one',
				myAttr2: 'two'
			}
		}
		let abstractThing1: TimelineContentObject = {
			id: 'a1',
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: mockTime.now + 1000
			},
			duration: 1000,
			LLayer: 'myLayer1',
			content: {
				myAttr1: 'three',
				myAttr2: 'four'
			}
		}

		let device0Container = conductor.getDevice('device0')
		let device0 = device0Container.device
		let device1Container = conductor.getDevice('device1')
		let device1 = device1Container.device

		// The queues should be empty
		expect(await device0['queue']).toHaveLength(0)
		expect(await device1['queue']).toHaveLength(0)

		conductor.timeline = [abstractThing0, abstractThing1]

		// there should now be one command queued:
		await mockTime.tick()
		expect(await device0['queue']).toHaveLength(1)
		expect(await device1['queue']).toHaveLength(0)

		// Move forward in time
		await mockTime.advanceTimeTicks(500) // to time 10500

		expect(commandReceiver0).toHaveBeenCalledTimes(1)
		expect(commandReceiver0.mock.calls[0][0]).toEqual(10000)
		expect(commandReceiver0.mock.calls[0][1]).toMatchObject({
			commandName: 'addedAbstract',
			content: {
				GLayer: 'myLayer0',
				myAttr1: 'one',
				myAttr2: 'two'
			}

		})
		expect(commandReceiver0.mock.calls[0][2]).toEqual('added: a0') // context
		expect(commandReceiver1).toHaveBeenCalledTimes(0)

		commandReceiver0.mockClear()
		await mockTime.advanceTimeToTicks(11500)

		// expect(device0['queue']).toHaveLength(0)

		expect(commandReceiver0).toHaveBeenCalledTimes(1)
		expect(commandReceiver0.mock.calls[0][0]).toEqual(11000)
		expect(commandReceiver0.mock.calls[0][1]).toMatchObject({
			commandName: 'removedAbstract',
			content: {
				GLayer: 'myLayer0',
				myAttr1: 'one',
				myAttr2: 'two'
			}
		})
		expect(commandReceiver0.mock.calls[0][2]).toEqual('removed: a0') // context
		expect(commandReceiver1).toHaveBeenCalledTimes(1)
		expect(commandReceiver1.mock.calls[0][0]).toEqual(11000)
		expect(commandReceiver1.mock.calls[0][1]).toMatchObject({
			commandName: 'addedAbstract',
			content: {
				GLayer: 'myLayer1',
				myAttr1: 'three',
				myAttr2: 'four'
			}
		})

		commandReceiver0.mockClear()
		commandReceiver1.mockClear()
		await mockTime.advanceTimeTicks(3000)

		expect(commandReceiver0).toHaveBeenCalledTimes(0)
		expect(commandReceiver1).toHaveBeenCalledTimes(1)
		expect(commandReceiver1.mock.calls[0][0]).toEqual(12000)
		expect(commandReceiver1.mock.calls[0][1]).toMatchObject({
			commandName: 'removedAbstract',
			content: {
				GLayer: 'myLayer1',
				myAttr1: 'three',
				myAttr2: 'four'
			}
		})
		expect(commandReceiver1.mock.calls[0][2]).toEqual('removed: a1') // context

		await conductor.removeDevice('device1')
		expect(conductor.getDevice('device1')).toBeFalsy()

		await conductor.addDevice(
			'device1',
			{ type: DeviceType.ABSTRACT, options: { commandReceiver: commandReceiver1 } }
		).then((res) => {
			expect(res).toBeTruthy()
		})

		await conductor.setMapping({
			'myLayer0': myLayerMapping1,
			'myLayer1': myLayerMapping0
		})
		abstractThing0.trigger.value = mockTime.now
		conductor.timeline = [ abstractThing0 ]
	})

	test('Test the "Now" and "Callback-functionality', async () => {

		let commandReceiver0 = jest.fn(() => {
			return Promise.resolve()
		})

		let myLayerMapping0: MappingAbstract = {
			device: DeviceType.ABSTRACT,
			deviceId: 'device0'
		}
		let myLayerMapping: Mappings = {
			'myLayer0': myLayerMapping0
		}

		let conductor = new Conductor({
			initializeAsClear: true,
			getCurrentTime: mockTime.getCurrentTime
		})

		await conductor.init()
		await conductor.addDevice('device0', {
			type: DeviceType.ABSTRACT,
			options: {
				commandReceiver: commandReceiver0
			}
		})
		await conductor.setMapping(myLayerMapping)

		// add something that will play "now"
		let abstractThing0: TimelineContentObject = { // will be converted from "now" to 10000
			id: 'a0',
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: 'now' // 10000
			},
			duration: 5000, // 15000
			LLayer: 'myLayer0',
			content: {
				myAttr1: 'one',
				myAttr2: 'two'
			}
		}
		let abstractThing1: TimelineContentObject = { // will cause a callback to be sent
			id: 'a1',
			trigger: {
				type: TriggerType.TIME_RELATIVE,
				value: '#a0.start + 300' // 10300
			},
			duration: 5000, // 15300
			LLayer: 'myLayer0',
			content: {
				myAttr1: 'one',
				myAttr2: 'two',
				callBack: 'abc',
				callBackData: {
					hello: 'dude'
				},
				callBackStopped: 'abcStopped'
			}
		}
		let timeline = [abstractThing0, abstractThing1]

		let setTimelineTriggerTime = jest.fn((results: TimelineTriggerTimeResult) => {
			_.each(results, (trigger) => {
				let o = _.findWhere(timeline, { id: trigger.id })
				if (o) {
					o.trigger.value = trigger.time
				}
			})
			// update the timeline:
			conductor.timeline = timeline
		})
		conductor.on('setTimelineTriggerTime', setTimelineTriggerTime)
		let timelineCallback = jest.fn()
		conductor.on('timelineCallback', timelineCallback)

		let device0Container = conductor.getDevice('device0')
		let device0 = device0Container.device as ThreadedClass<AbstractDevice>
		expect(device0).toBeTruthy()
		// let device1 = conductor.getDevice('device1')

		// The queues should be empty
		expect(await device0.queue).toHaveLength(0)
		// expect(device1['queue']).toHaveLength(0)

		conductor.timeline = timeline

		// there should now be commands queued:
		await mockTime.tick()
		const q = await device0.queue

		expect(q).toHaveLength(2)
		expect(q[0].time).toEqual(10000)
		expect(q[1].time).toEqual(10300)

		// the setTimelineTriggerTime event should have been emitted:
		expect(setTimelineTriggerTime).toHaveBeenCalledTimes(1)
		expect(setTimelineTriggerTime.mock.calls[0][0][0].time).toEqual(10000)

		// the timelineCallback event should have been emitted:
		expect(timelineCallback).toHaveBeenCalledTimes(0)

		// Move forward in time
		await mockTime.advanceTimeTicks(100) // to time 1100

		expect(commandReceiver0).toHaveBeenCalledTimes(1)
		expect(timelineCallback).toHaveBeenCalledTimes(0)

		await mockTime.advanceTimeTicks(400) // to time 1500

		expect(commandReceiver0).toHaveBeenCalledTimes(2)
		expect(timelineCallback).toHaveBeenCalledTimes(1)
		expect(timelineCallback.mock.calls[0][0]).toEqual(10300)
		expect(timelineCallback.mock.calls[0][1]).toEqual('a1')
		expect(timelineCallback.mock.calls[0][2]).toEqual('abc')
		expect(timelineCallback.mock.calls[0][3]).toEqual({ hello: 'dude' })

		await mockTime.advanceTimeTicks(5000) // to time 6500

		// expect(commandReceiver0).toHaveBeenCalledTimes(3)
		expect(commandReceiver0.mock.calls).toHaveLength(3)
	})

	test('devicesMakeReady', async () => {
		let commandReceiver0 = jest.fn(() => {
			return Promise.resolve()
		})
		let commandReceiver1 = jest.fn(() => {
			return Promise.resolve()
		})
		let commandReceiver2 = jest.fn(() => {
			return Promise.resolve()
		})
		let commandReceiver3 = jest.fn(() => {
			return Promise.resolve()
		})
		let commandReceiver4 = jest.fn(() => {
			return Promise.resolve()
		})

		let conductor = new Conductor({
			initializeAsClear: true,
			getCurrentTime: mockTime.getCurrentTime
		})

		await conductor.init()
		await conductor.addDevice('device0', {
			type: DeviceType.ABSTRACT,
			options: {
				commandReceiver: commandReceiver0
			}
		})
		await conductor.addDevice('device1', {
			type: DeviceType.CASPARCG,
			options: {
				commandReceiver: commandReceiver1
			}
		})
		await conductor.addDevice('device2', {
			type: DeviceType.ATEM,
			options: {
				commandReceiver: commandReceiver2
			}
		})
		await conductor.addDevice('device3', {
			type: DeviceType.HTTPSEND,
			options: {
				commandReceiver: commandReceiver3
			}
		})
		await conductor.addDevice('device4', {
			type: DeviceType.LAWO,
			options: {
				commandReceiver: commandReceiver4
			}
		})

		await conductor.devicesMakeReady(true)

		await mockTime.advanceTimeTicks(10) // to allow for commands to be sent

		// expect(commandReceiver1).toHaveBeenCalledTimes(3)
		expect(commandReceiver1.mock.calls).toHaveLength(3)
		// expect(commandReceiver1.mock.calls[0][1].name).toEqual('TimeCommand')
		// expect(commandReceiver1.mock.calls[0][1]._objectParams).toMatchObject({
		// 	channel: 1,
		// 	timecode: '00:00:10:00'
		// })
		// expect(commandReceiver1.mock.calls[1][1].name).toEqual('TimeCommand')
		// expect(commandReceiver1.mock.calls[1][1]._objectParams).toMatchObject({
		// 	channel: 2,
		// 	timecode: '00:00:10:00'
		// })
		// expect(commandReceiver1.mock.calls[2][1].name).toEqual('TimeCommand')
		// expect(commandReceiver1.mock.calls[2][1]._objectParams).toMatchObject({
		// 	channel: 3,
		// 	timecode: '00:00:10:00'
		// })

		expect(commandReceiver1.mock.calls[0][1].name).toEqual('ClearCommand')
		expect(commandReceiver1.mock.calls[0][1]._objectParams).toMatchObject({
			channel: 1
		})
		expect(commandReceiver1.mock.calls[1][1].name).toEqual('ClearCommand')
		expect(commandReceiver1.mock.calls[1][1]._objectParams).toMatchObject({
			channel: 2
		})
		expect(commandReceiver1.mock.calls[2][1].name).toEqual('ClearCommand')
		expect(commandReceiver1.mock.calls[2][1]._objectParams).toMatchObject({
			channel: 3
		})
	})
})
