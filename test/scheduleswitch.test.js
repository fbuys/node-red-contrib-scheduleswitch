const helper = require("node-red-node-test-helper");
const scheduleswitchNode = require("../scheduleswitch.js");

jest.useFakeTimers();
jest.spyOn(global, "setTimeout");
jest.spyOn(global, "setInterval");

describe("scheduleswitch", () => {
  beforeEach(() => {
    global.console = require("console");
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    helper.unload();
  });

  let DEFAULT_FLOW = [
    {
      id: "n1",
      type: "scheduleswitch",
      name: "",
      ontopic: "",
      offtopic: "",
      onpayload: "",
      offpayload: "",
      onpayloadType: "str",
      offpayloadType: "str",
      disabled: false,
      schedules: [
        {
          // Skip Saturdays
          on_days: [true, true, true, true, true, true, false],
          on_h: "00",
          on_m: "00",
          on_s: "00",
          off_h: "00",
          off_m: "01",
          off_s: "00",
          valid: true,
        },
      ],
      wires: [[]],
    },
  ];

  const exampleFlow = (nodeOverrides = {}) => {
    return [
      {
        id: "n1",
        type: "scheduleswitch",
        name: "",
        ontopic: "",
        offtopic: "",
        onpayload: "",
        offpayload: "",
        onpayloadType: "str",
        offpayloadType: "str",
        disabled: false,
        schedules: [
          {
            // Skip Saturdays
            on_days: [true, true, true, true, true, true, false],
            on_h: "00",
            on_m: "00",
            on_s: "00",
            off_h: "00",
            off_m: "01",
            off_s: "00",
            valid: true,
          },
        ],
        wires: [[]],
        ...nodeOverrides,
      },
    ];
  };

  const getNode = async (nodeId, flow) => {
    let node = null;
    await helper.load(scheduleswitchNode, flow, () => {
      node = helper.getNode(nodeId);
    });
    return node;
  };
  describe("send", () => {
    describe("when scheduled time starts", () => {
      it("sends on", async () => {
        jest.setSystemTime(new Date("2023-11-05T23:59:59"));
        const n = await getNode("n1", exampleFlow());
        n.send = jest.fn();

        jest.advanceTimersByTime(1000);

        expect(n.send.mock.calls).toHaveLength(1);
        expect(n.send.mock.calls[0][0].payload).toBe("off");
        expect(n.scheduleswitch.state()).toBe("off");

        jest.advanceTimersByTime(1000);

        expect(n.send.mock.calls).toHaveLength(2);
        expect(n.send.mock.calls[1][0].payload).toBe("on");
        expect(n.scheduleswitch.state()).toBe("on");
      });
    });

    describe("when scheduled time ends", () => {
      it("sends off", async () => {
        jest.setSystemTime(new Date("2023-11-05T23:59:59")); // 1s before start
        const n = await getNode("n1", exampleFlow());
        n.send = jest.fn();

        jest.advanceTimersByTime(2000);

        expect(n.scheduleswitch.state()).toBe("on");

        jest.advanceTimersByTime(60000); // run to end of scheduled time

        expect(n.send.mock.calls).toHaveLength(3);
        expect(n.send.mock.calls[0][0].payload).toBe("off");
        expect(n.send.mock.calls[1][0].payload).toBe("on");
        expect(n.send.mock.calls[2][0].payload).toBe("off");
        expect(n.scheduleswitch.state()).toBe("off");
        expect(new Date()).toStrictEqual(new Date("2023-11-06T00:01:01"));
      });
    });

    describe("when on a skipped/off day", () => {
      it("stays off when started on skipped day", async () => {
        // 4th is a skipped day
        jest.setSystemTime(new Date("2023-11-04T00:00:30"));
        const n = await getNode("n1", exampleFlow());
        n.send = jest.fn();

        jest.advanceTimersByTime(1000);

        expect(n.send.mock.calls).toHaveLength(1);
        expect(n.send.mock.calls[0][0].payload).toBe("off");
        expect(n.scheduleswitch.state()).toBe("off");
      });

      it("stays off when started before skipped time", async () => {
        // 4th is a skipped day
        jest.setSystemTime(new Date("2023-11-03T23:59:59"));
        const n = await getNode("n1", exampleFlow());
        n.send = jest.fn();

        jest.advanceTimersByTime(2000);

        expect(n.send.mock.calls).toHaveLength(1);
        expect(n.send.mock.calls[0][0].payload).toBe("off");
        expect(n.scheduleswitch.state()).toBe("off");
      });
    });

    describe("with payload", () => {
      it("sends on instantly", async () => {
        const n = await getNode("n1", exampleFlow());
        n.send = jest.fn();

        n.receive({ payload: "on" });

        expect(n.send.mock.calls).toHaveLength(1);
        expect(n.send.mock.calls[0][0].payload).toBe("on");
        expect(n.scheduleswitch.state()).toBe("on");
      });
    });

    describe("payload type is set to json", () => {
      it("sends on", async () => {
        jest.setSystemTime(new Date("2023-11-05T23:59:59"));
        const n = await getNode(
          "n1",
          exampleFlow({
            onpayload: '{ "a": 1 }',
            offpayload: '{ "b": 2 }',
            onpayloadType: "json",
            offpayloadType: "json",
          }),
        );
        n.send = jest.fn();

        jest.advanceTimersByTime(1000);

        expect(n.send.mock.calls[0][0].payload).toEqual({ b: 2 });

        jest.advanceTimersByTime(1000);

        expect(n.send.mock.calls[1][0].payload).toEqual({ a: 1 });
      });
    });
  });
});
