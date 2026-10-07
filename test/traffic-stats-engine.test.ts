/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TrafficStatsEngine, formatLocalDate } from '../src/main/traffic/traffic-stats-engine'

describe('TrafficStatsEngine', () => {
  const baseTime = Date.parse('2026-09-26T12:00:00Z')

  // 1. 单连接连续增长
  it('1. 单连接连续增长', () => {
    const engine = new TrafficStatsEngine()
    // 首次采样，建立 baseline
    engine.feedSnapshot(
      {
        uploadTotal: 100,
        downloadTotal: 200,
        connections: [
          {
            id: 'c1',
            upload: 100,
            download: 200,
            chains: ['Node1', 'Group1']
          } as any
        ]
      },
      baseTime
    )

    // 第二次采样，连接增长 up +50, down +100
    engine.feedSnapshot(
      {
        uploadTotal: 150,
        downloadTotal: 300,
        connections: [
          {
            id: 'c1',
            upload: 150,
            download: 300,
            chains: ['Node1', 'Group1']
          } as any
        ]
      },
      baseTime + 1000
    )

    const summary = engine.getSummary('today', baseTime + 1000)
    assert.equal(summary.totalUpload, 50)
    assert.equal(summary.totalDownload, 100)
    assert.equal(summary.total, 150)
    assert.equal(summary.nodes.length, 1)
    assert.equal(summary.nodes[0].name, 'Node1')
    assert.equal(summary.nodes[0].upload, 50)
    assert.equal(summary.nodes[0].download, 100)
    assert.equal(summary.groups.length, 1)
    assert.equal(summary.groups[0].name, 'Group1')
    assert.equal(summary.groups[0].upload, 50)
    assert.equal(summary.groups[0].download, 100)
    assert.equal(summary.unknownTotal, 0)
  })

  // 2. 多连接同时增长
  it('2. 多连接同时增长', () => {
    const engine = new TrafficStatsEngine()
    // baseline
    engine.feedSnapshot(
      {
        uploadTotal: 300,
        downloadTotal: 600,
        connections: [
          { id: 'c1', upload: 100, download: 200, chains: ['NodeA', 'GroupA'] } as any,
          { id: 'c2', upload: 200, download: 400, chains: ['NodeB', 'GroupB'] } as any
        ]
      },
      baseTime
    )

    // c1 up +10, down +20; c2 up +30, down +40; 全局 up +40, down +60
    engine.feedSnapshot(
      {
        uploadTotal: 340,
        downloadTotal: 660,
        connections: [
          { id: 'c1', upload: 110, download: 220, chains: ['NodeA', 'GroupA'] } as any,
          { id: 'c2', upload: 230, download: 440, chains: ['NodeB', 'GroupB'] } as any
        ]
      },
      baseTime + 1000
    )

    const summary = engine.getSummary('today', baseTime + 1000)
    assert.equal(summary.totalUpload, 40)
    assert.equal(summary.totalDownload, 60)
    assert.equal(summary.total, 100)
    assert.equal(summary.nodes.length, 2)

    const nodeA = summary.nodes.find((n) => n.name === 'NodeA')!
    assert.equal(nodeA.upload, 10)
    assert.equal(nodeA.download, 20)

    const nodeB = summary.nodes.find((n) => n.name === 'NodeB')!
    assert.equal(nodeB.upload, 30)
    assert.equal(nodeB.download, 40)
  })

  // 3. 新连接出现
  it('3. 新连接出现', () => {
    const engine = new TrafficStatsEngine()
    // baseline 只有 c1
    engine.feedSnapshot(
      {
        uploadTotal: 100,
        downloadTotal: 100,
        connections: [{ id: 'c1', upload: 100, download: 100, chains: ['Node1'] } as any]
      },
      baseTime
    )

    // 新连接 c2 出现，c2 本身上传了 50，下载了 80。全局相应增加 50, 80
    engine.feedSnapshot(
      {
        uploadTotal: 150,
        downloadTotal: 180,
        connections: [
          { id: 'c1', upload: 100, download: 100, chains: ['Node1'] } as any,
          { id: 'c2', upload: 50, download: 80, chains: ['Node2', 'Group2'] } as any
        ]
      },
      baseTime + 1000
    )

    const summary = engine.getSummary('today', baseTime + 1000)
    const node2 = summary.nodes.find((n) => n.name === 'Node2')!
    assert.ok(node2)
    assert.equal(node2.upload, 50)
    assert.equal(node2.download, 80)
    assert.equal(summary.totalUpload, 50)
    assert.equal(summary.totalDownload, 80)
  })

  // 4. 连接消失
  it('4. 连接消失', () => {
    const engine = new TrafficStatsEngine()
    engine.feedSnapshot(
      {
        uploadTotal: 100,
        downloadTotal: 100,
        connections: [{ id: 'c1', upload: 100, download: 100, chains: ['Node1'] } as any]
      },
      baseTime
    )

    // c1 消失了，全局上传增加 20（比如关闭时的残余流量）。由于没有存活连接，这 20 应进入 Unknown
    engine.feedSnapshot(
      {
        uploadTotal: 120,
        downloadTotal: 100,
        connections: []
      },
      baseTime + 1000
    )

    const summary = engine.getSummary('today', baseTime + 1000)
    assert.equal(summary.totalUpload, 20)
    assert.equal(summary.unknownUpload, 20)
    assert.equal(summary.nodes.length, 0)
  })

  // 5. 节点/group 聚合
  it('5. 节点/group 聚合', () => {
    const engine = new TrafficStatsEngine()
    engine.feedSnapshot(
      {
        uploadTotal: 0,
        downloadTotal: 0,
        connections: []
      },
      baseTime
    )

    // 两个连接同一个节点 NodeA，但属于不同策略组 GroupA 和 GroupB
    // 一个连接节点 NodeB，属于 GroupA
    engine.feedSnapshot(
      {
        uploadTotal: 100,
        downloadTotal: 200,
        connections: [
          { id: 'c1', upload: 20, download: 40, chains: ['NodeA', 'GroupA'] } as any,
          { id: 'c2', upload: 30, download: 60, chains: ['NodeA', 'GroupB'] } as any,
          { id: 'c3', upload: 50, download: 100, chains: ['NodeB', 'GroupA'] } as any
        ]
      },
      baseTime + 1000
    )

    const summary = engine.getSummary('today', baseTime + 1000)
    const nodeA = summary.nodes.find((n) => n.name === 'NodeA')!
    assert.equal(nodeA.upload, 50)
    assert.equal(nodeA.download, 100)

    const nodeB = summary.nodes.find((n) => n.name === 'NodeB')!
    assert.equal(nodeB.upload, 50)
    assert.equal(nodeB.download, 100)

    const groupA = summary.groups.find((g) => g.name === 'GroupA')!
    assert.equal(groupA.upload, 70) // c1 + c3 = 20 + 50
    assert.equal(groupA.download, 140) // 40 + 100

    const groupB = summary.groups.find((g) => g.name === 'GroupB')!
    assert.equal(groupB.upload, 30) // c2
    assert.equal(groupB.download, 60)
  })

  // 6. DIRECT / 空 chains
  it('6. DIRECT / 空 chains 正常统计', () => {
    const engine = new TrafficStatsEngine()
    engine.feedSnapshot({ uploadTotal: 0, downloadTotal: 0, connections: [] }, baseTime)

    // c1 chains 为空，c2 chains 为 ['DIRECT']
    engine.feedSnapshot(
      {
        uploadTotal: 60,
        downloadTotal: 90,
        connections: [
          { id: 'c1', upload: 20, download: 30, chains: [] } as any,
          { id: 'c2', upload: 40, download: 60, chains: ['DIRECT'] } as any
        ]
      },
      baseTime + 1000
    )

    const summary = engine.getSummary('today', baseTime + 1000)
    assert.equal(summary.nodes.length, 1)
    assert.equal(summary.nodes[0].name, 'DIRECT')
    assert.equal(summary.nodes[0].upload, 60)
    assert.equal(summary.nodes[0].download, 90)
    assert.equal(summary.groups[0].name, 'DIRECT')
  })

  // 7. global total 与 connection delta 差异进入 Unknown
  it('7. global total 与 connection delta 差异进入 Unknown', () => {
    const engine = new TrafficStatsEngine()
    engine.feedSnapshot(
      {
        uploadTotal: 100,
        downloadTotal: 100,
        connections: [{ id: 'c1', upload: 50, download: 50, chains: ['Node1'] } as any]
      },
      baseTime
    )

    // c1 up +10, down +20 (连接 delta: 10, 20)
    // 但全局 up +30, down +50 (短连接或内部直连消耗了 20, 30)
    engine.feedSnapshot(
      {
        uploadTotal: 130,
        downloadTotal: 150,
        connections: [{ id: 'c1', upload: 60, download: 70, chains: ['Node1'] } as any]
      },
      baseTime + 1000
    )

    const summary = engine.getSummary('today', baseTime + 1000)
    assert.equal(summary.nodes[0].upload, 10)
    assert.equal(summary.nodes[0].download, 20)
    assert.equal(summary.unknownUpload, 20)
    assert.equal(summary.unknownDownload, 30)
    assert.equal(summary.totalUpload, 30)
    assert.equal(summary.totalDownload, 50)
    assert.equal(summary.total, 80)
  })

  // 8. Mihomo total reset
  it('8. Mihomo total reset (core 重启)', () => {
    const engine = new TrafficStatsEngine()
    engine.feedSnapshot(
      {
        uploadTotal: 10000,
        downloadTotal: 20000,
        connections: [{ id: 'c1', upload: 5000, download: 10000, chains: ['Node1'] } as any]
      },
      baseTime
    )

    // core 重启，全局 total 重置为接近 0，连接也是新建立的连接
    engine.feedSnapshot(
      {
        uploadTotal: 10,
        downloadTotal: 20,
        connections: [{ id: 'c2', upload: 5, download: 10, chains: ['Node2'] } as any]
      },
      baseTime + 1000
    )

    // reset 周期 delta 计为 0，不应产生负数或上万虚假数值
    const summaryAfterReset = engine.getSummary('today', baseTime + 1000)
    assert.equal(summaryAfterReset.total, 0)

    // 后续正常增长
    engine.feedSnapshot(
      {
        uploadTotal: 40,
        downloadTotal: 70,
        connections: [{ id: 'c2', upload: 35, download: 60, chains: ['Node2'] } as any]
      },
      baseTime + 2000
    )

    const summary = engine.getSummary('today', baseTime + 2000)
    assert.equal(summary.nodes[0].name, 'Node2')
    assert.equal(summary.nodes[0].upload, 30) // 35 - 5
    assert.equal(summary.nodes[0].download, 50) // 60 - 10
  })

  // 9. checkpoint 恢复避免重复累计
  it('9. checkpoint 恢复避免重复累计', () => {
    // 假设 Sparkle 上次运行保存的 checkpoint
    const initialCheckpoint = {
      lastCoreUploadTotal: 5000,
      lastCoreDownloadTotal: 10000,
      lastTimestamp: baseTime - 60000
    }

    const engine = new TrafficStatsEngine({
      version: 1,
      checkpoint: initialCheckpoint,
      days: {}
    })

    // Sparkle 重新启动，连上同一个 core，当前 core 总计 5100 / 10200
    // 连接 c1 之前已经传输了 4000 / 8000
    engine.feedSnapshot(
      {
        uploadTotal: 5100,
        downloadTotal: 10200,
        connections: [
          { id: 'c1', upload: 4000, download: 8000, chains: ['Node1', 'Group1'] } as any
        ]
      },
      baseTime
    )

    // 首次采样：离线流量 100 / 200 进入 Unknown，而 c1 历史流量 4000/8000 不计入增量
    const summaryInit = engine.getSummary('today', baseTime)
    assert.equal(summaryInit.unknownUpload, 100)
    assert.equal(summaryInit.unknownDownload, 200)
    assert.equal(summaryInit.nodes.length, 0) // c1 历史流量没有重复计入！

    // 第二次采样，c1 产生真实增量 +50 / +50
    engine.feedSnapshot(
      {
        uploadTotal: 5150,
        downloadTotal: 10250,
        connections: [
          { id: 'c1', upload: 4050, download: 8050, chains: ['Node1', 'Group1'] } as any
        ]
      },
      baseTime + 1000
    )

    const summaryAfter = engine.getSummary('today', baseTime + 1000)
    assert.equal(summaryAfter.nodes[0].upload, 50)
    assert.equal(summaryAfter.nodes[0].download, 50)
  })

  // 10. 跨日
  it('10. 跨日统计', () => {
    const engine = new TrafficStatsEngine()
    // Day 1: 2026-09-26 23:59:58
    const day1Time = Date.parse('2026-09-26T23:59:58')
    engine.feedSnapshot(
      {
        uploadTotal: 100,
        downloadTotal: 100,
        connections: [{ id: 'c1', upload: 100, download: 100, chains: ['Node1'] } as any]
      },
      day1Time
    )

    // Day 1 增长
    engine.feedSnapshot(
      {
        uploadTotal: 150,
        downloadTotal: 150,
        connections: [{ id: 'c1', upload: 150, download: 150, chains: ['Node1'] } as any]
      },
      day1Time + 1000
    )

    // 跨日到 Day 2: 2026-09-27 00:00:02
    const day2Time = Date.parse('2026-09-27T00:00:02')
    engine.feedSnapshot(
      {
        uploadTotal: 220,
        downloadTotal: 240,
        connections: [{ id: 'c1', upload: 220, download: 240, chains: ['Node1'] } as any]
      },
      day2Time
    )

    // 查看 Day 2 (Today)
    const summaryDay2 = engine.getSummary('today', day2Time)
    assert.equal(summaryDay2.nodes[0].upload, 70) // 220 - 150
    assert.equal(summaryDay2.nodes[0].download, 90) // 240 - 150

    // 查看 All Time (Day1 + Day2)
    const summaryAll = engine.getSummary('all', day2Time)
    assert.equal(summaryAll.nodes[0].upload, 120) // 50 + 70
    assert.equal(summaryAll.nodes[0].download, 140) // 50 + 90
  })

  // 11. counter 不应产生负 delta
  it('11. counter 不应产生负 delta', () => {
    const engine = new TrafficStatsEngine()
    engine.feedSnapshot(
      {
        uploadTotal: 500,
        downloadTotal: 500,
        connections: [{ id: 'c1', upload: 200, download: 300, chains: ['Node1'] } as any]
      },
      baseTime
    )

    // 连接计数由于某种原因回退（如 200 变为 100）
    engine.feedSnapshot(
      {
        uploadTotal: 500,
        downloadTotal: 500,
        connections: [{ id: 'c1', upload: 100, download: 200, chains: ['Node1'] } as any]
      },
      baseTime + 1000
    )

    const summary = engine.getSummary('today', baseTime + 1000)
    assert.equal(summary.totalUpload, 0)
    assert.equal(summary.totalDownload, 0)
    assert.equal(summary.total, 0)
  })

  // 12. Unknown 待归属余额模型：流量从 Unknown 重新归属至 Node，Total 严格等于全局增量
  it('12. Unknown 待归属余额重新归属 (先全局多，后连接爆发追平)', () => {
    const engine = new TrafficStatsEngine()
    // baseline: global 0, c1 0
    engine.feedSnapshot(
      {
        uploadTotal: 0,
        downloadTotal: 0,
        connections: [{ id: 'c1', upload: 0, download: 0, chains: ['Node1'] } as any]
      },
      baseTime
    )

    // t1: global +100 (up 100), connections +90 (c1 up 90)
    // 此时 Node +90, Unknown +10, Total +100
    engine.feedSnapshot(
      {
        uploadTotal: 100,
        downloadTotal: 0,
        connections: [{ id: 'c1', upload: 90, download: 0, chains: ['Node1'] } as any]
      },
      baseTime + 1000
    )

    const summaryT1 = engine.getSummary('today', baseTime + 1000)
    assert.equal(summaryT1.nodes[0].upload, 90)
    assert.equal(summaryT1.unknownUpload, 10)
    assert.equal(summaryT1.totalUpload, 100)

    // t2: global +100 (up 200), connections +110 (c1 up 200)
    // 多出来的 10 从已有 Unknown 转移回 Node: Node = 200, Unknown = 0, Total = 200
    engine.feedSnapshot(
      {
        uploadTotal: 200,
        downloadTotal: 0,
        connections: [{ id: 'c1', upload: 200, download: 0, chains: ['Node1'] } as any]
      },
      baseTime + 2000
    )

    const summaryT2 = engine.getSummary('today', baseTime + 2000)
    assert.equal(summaryT2.nodes[0].upload, 200)
    assert.equal(summaryT2.unknownUpload, 0)
    assert.equal(summaryT2.totalUpload, 200)
    assert.equal(summaryT2.total, 200)
  })

  // 13. 时差反向抖动：连接先行，全局下期追平，绝无双计
  it('13. 采样时差防双计测试 (连接先行 100 全局 90，后续全局追平 110 连接 100)', () => {
    const engine = new TrafficStatsEngine()
    // baseline
    engine.feedSnapshot(
      {
        uploadTotal: 0,
        downloadTotal: 0,
        connections: [{ id: 'c1', upload: 0, download: 0, chains: ['Node1'] } as any]
      },
      baseTime
    )

    // Snapshot N: global 90, c1 100
    engine.feedSnapshot(
      {
        uploadTotal: 90,
        downloadTotal: 0,
        connections: [{ id: 'c1', upload: 100, download: 0, chains: ['Node1'] } as any]
      },
      baseTime + 1000
    )

    const summaryN = engine.getSummary('today', baseTime + 1000)
    assert.equal(summaryN.nodes[0].upload, 100)
    assert.equal(summaryN.unknownUpload, 0)
    assert.equal(summaryN.totalUpload, 100) // 保底等于已归属值

    // Snapshot N+1: 全局计数追上来 global 200 (+110), c1 200 (+100)
    engine.feedSnapshot(
      {
        uploadTotal: 200,
        downloadTotal: 0,
        connections: [{ id: 'c1', upload: 200, download: 0, chains: ['Node1'] } as any]
      },
      baseTime + 2000
    )

    const summaryFinal = engine.getSummary('today', baseTime + 2000)
    // 最终：全局增量为 200，Sparkle stats 必须等于 200，绝对不能是 210 双计！
    assert.equal(summaryFinal.nodes[0].upload, 200)
    assert.equal(summaryFinal.unknownUpload, 0)
    assert.equal(summaryFinal.totalUpload, 200)
    assert.equal(summaryFinal.total, 200)
  })

  // 14. 临时缺失连接 (Temporary Missing -> Reappear with same ID) 防重复记账
  it('14. 连接临时缺失并在 Grace Period 内重现不重复记账', () => {
    // 设置 grace period 5000ms
    const engine = new TrafficStatsEngine(undefined, { connectionGracePeriodMs: 5000 })

    // snap 1: 建立 baseline
    engine.feedSnapshot(
      {
        uploadTotal: 100,
        downloadTotal: 200,
        connections: [{ id: 'c1', upload: 100, download: 200, chains: ['Node1'] } as any]
      },
      baseTime
    )

    // snap 2 (c1 增量 50 / 50)
    engine.feedSnapshot(
      {
        uploadTotal: 150,
        downloadTotal: 250,
        connections: [{ id: 'c1', upload: 150, download: 250, chains: ['Node1'] } as any]
      },
      baseTime + 1000
    )

    const s1 = engine.getSummary('today', baseTime + 1000)
    assert.equal(s1.nodes[0].upload, 50)
    assert.equal(s1.nodes[0].download, 50)

    // snap 3 (抖动：c1 在快照中暂时缺失，时间在 1 秒后，处于 5 秒 grace period 内)
    engine.feedSnapshot(
      {
        uploadTotal: 150,
        downloadTotal: 250,
        connections: []
      },
      baseTime + 2000
    )

    // snap 4 (c1 重新出现，继续增长了 30 / 40，累计到 upload 180, download 290)
    engine.feedSnapshot(
      {
        uploadTotal: 180,
        downloadTotal: 290,
        connections: [{ id: 'c1', upload: 180, download: 290, chains: ['Node1'] } as any]
      },
      baseTime + 3000
    )

    const sFinal = engine.getSummary('today', baseTime + 3000)
    // 如果没有 Grace Period，c1 会被当作全新连接，在 snap 4 将 180/290 全量重复计入！
    // 有了 Grace Period，增量只计算真实的 30 / 40，总归属为 50 + 30 = 80，50 + 40 = 90！
    assert.equal(sFinal.nodes[0].upload, 80)
    assert.equal(sFinal.nodes[0].download, 90)
    assert.equal(sFinal.totalUpload, 80)
    assert.equal(sFinal.totalDownload, 90)
  })

  // 15. Core Instance 识别与冷启动歧义防范
  it('15. Core Instance 标识符识别与双向计数器单调检查', () => {
    // 假设 Sparkle 上次退出时，Core instance 为 "instance_A"，总计为 1000 / 1000
    const engine = new TrafficStatsEngine({
      version: 1,
      checkpoint: {
        coreInstanceId: 'instance_A',
        lastCoreUploadTotal: 1000,
        lastCoreDownloadTotal: 1000,
        lastTimestamp: baseTime - 60000
      },
      days: {}
    })

    // 场景 A: 期间 Core 重启成新实例 "instance_B"，新实例总计碰巧超过了 1000 (如 1200 / 1200)
    // 因为 instanceId 不同，引擎准确识别为不同 Core 实例，不将 (1200 - 1000 = 200) 错算为离线差额！
    engine.feedSnapshot(
      {
        uploadTotal: 1200,
        downloadTotal: 1200,
        connections: [{ id: 'c1', upload: 600, download: 600, chains: ['Node1'] } as any]
      },
      baseTime,
      'instance_B'
    )

    const sA = engine.getSummary('today', baseTime)
    assert.equal(sA.unknownUpload, 0)
    assert.equal(sA.totalUpload, 0) // baseline 建立，不产生误算差额！

    // 场景 B: 同一实例 "instance_B"，后续正常增长到 1250 / 1250
    engine.feedSnapshot(
      {
        uploadTotal: 1250,
        downloadTotal: 1250,
        connections: [{ id: 'c1', upload: 650, download: 650, chains: ['Node1'] } as any]
      },
      baseTime + 1000,
      'instance_B'
    )

    const sB = engine.getSummary('today', baseTime + 1000)
    assert.equal(sB.nodes[0].upload, 50)
    assert.equal(sB.nodes[0].download, 50)
    assert.equal(sB.totalUpload, 50)
    assert.equal(sB.totalDownload, 50)
  })

  // 16. Sparkle 重启 + 同一 Core + 存活长连接：checkpoint 准确归属离线期间长连接产生的 delta
  it('16. Sparkle 重启 + 同一 Core + 存活长连接继承增量', () => {
    // 假设 Sparkle 退出时，Core 为 instance_A，全局 5000 / 10000
    // 连接 c1 存活，退出时 upload: 4000, download: 8000
    const initialCheckpoint = {
      coreInstanceId: 'instance_A',
      lastCoreUploadTotal: 5000,
      lastCoreDownloadTotal: 10000,
      lastTimestamp: baseTime - 60000,
      activeConnections: {
        c1: {
          upload: 4000,
          download: 8000,
          chains: ['Node1', 'Group1']
        }
      }
    }

    const engine = new TrafficStatsEngine({
      version: 1,
      checkpoint: initialCheckpoint,
      days: {}
    })

    // Sparkle 重新启动，连上同一个 instance_A
    // 全局增加到 5100 / 10200 (全局增量 gap: 100 / 200)
    // 存活连接 c1 增加到 4060 / 8120 (c1 离线增量: 60 / 120)
    // 另外 40 / 80 为离线期间其他已关闭连接产生的流量
    engine.feedSnapshot(
      {
        uploadTotal: 5100,
        downloadTotal: 10200,
        connections: [
          { id: 'c1', upload: 4060, download: 8120, chains: ['Node1', 'Group1'] } as any
        ]
      },
      baseTime,
      'instance_A'
    )

    const summaryInit = engine.getSummary('today', baseTime)
    // 验证：存活连接 c1 的离线增量精确归属于 Node1 / Group1
    assert.equal(summaryInit.nodes.length, 1)
    assert.equal(summaryInit.nodes[0].name, 'Node1')
    assert.equal(summaryInit.nodes[0].upload, 60)
    assert.equal(summaryInit.nodes[0].download, 120)

    assert.equal(summaryInit.groups.length, 1)
    assert.equal(summaryInit.groups[0].name, 'Group1')
    assert.equal(summaryInit.groups[0].upload, 60)
    assert.equal(summaryInit.groups[0].download, 120)

    // 离线期间已关闭连接的流量计入 Unknown
    assert.equal(summaryInit.unknownUpload, 40) // 100 - 60
    assert.equal(summaryInit.unknownDownload, 80) // 200 - 120

    // 总量严格等于全局离线增量
    assert.equal(summaryInit.totalUpload, 100)
    assert.equal(summaryInit.totalDownload, 200)
    assert.equal(summaryInit.total, 300)

    // 第二轮连续采样：c1 继续增长 40 / 30，全局增长 40 / 30
    engine.feedSnapshot(
      {
        uploadTotal: 5140,
        downloadTotal: 10230,
        connections: [
          { id: 'c1', upload: 4100, download: 8150, chains: ['Node1', 'Group1'] } as any
        ]
      },
      baseTime + 1000,
      'instance_A'
    )

    const summaryAfter = engine.getSummary('today', baseTime + 1000)
    assert.equal(summaryAfter.nodes[0].upload, 100) // 60 + 40
    assert.equal(summaryAfter.nodes[0].download, 150) // 120 + 30
    assert.equal(summaryAfter.unknownUpload, 40) // 保持 40
    assert.equal(summaryAfter.unknownDownload, 80) // 保持 80
    assert.equal(summaryAfter.totalUpload, 140)
    assert.equal(summaryAfter.totalDownload, 230)
    assert.equal(summaryAfter.total, 370)
  })

  // 17. Sparkle 重启 + 不同 Core + 新 Core 计数器超过旧 Core：coreInstanceId 阻止误判
  it('17. Sparkle 重启 + 不同 Core + 新 Core 计数器超过旧 Core (instanceId 阻止误判)', () => {
    const initialCheckpoint = {
      coreInstanceId: 'core_old_111',
      lastCoreUploadTotal: 100000,
      lastCoreDownloadTotal: 200000,
      lastTimestamp: baseTime - 60000,
      activeConnections: {
        c1: { upload: 80000, download: 150000, chains: ['NodeOld'] }
      }
    }

    const engine = new TrafficStatsEngine({
      version: 1,
      checkpoint: initialCheckpoint,
      days: {}
    })

    // 新 Core core_new_222 启动后已经跑了 150000 / 300000 (超过了旧 Core 的 100000 / 200000)
    // 并且里面碰巧有个同 id 连接 c1
    engine.feedSnapshot(
      {
        uploadTotal: 150000,
        downloadTotal: 300000,
        connections: [
          { id: 'c1', upload: 90000, download: 180000, chains: ['NodeOld'] } as any
        ]
      },
      baseTime,
      'core_new_222'
    )

    // 因为 instanceId 不同，不能把 150000 - 100000 算作离线增量，也不能继承旧 c1 的 offset
    const summary = engine.getSummary('today', baseTime)
    assert.equal(summary.totalUpload, 0)
    assert.equal(summary.totalDownload, 0)
    assert.equal(summary.total, 0)
    assert.equal(summary.nodes.length, 0)
  })

  // 18. Checkpoint active connection + 重启后连接已关闭：全局离线增量全额计入 Unknown，无虚假 Node delta
  it('18. Checkpoint active connection + 重启后连接已在离线期关闭', () => {
    const initialCheckpoint = {
      coreInstanceId: 'instance_A',
      lastCoreUploadTotal: 5000,
      lastCoreDownloadTotal: 10000,
      lastTimestamp: baseTime - 60000,
      activeConnections: {
        c1: { upload: 4000, download: 8000, chains: ['Node1', 'Group1'] }
      }
    }

    const engine = new TrafficStatsEngine({
      version: 1,
      checkpoint: initialCheckpoint,
      days: {}
    })

    // 重启后同实例 instance_A，但连接列表为空 (c1 在离线期间已关闭并结束)
    // 全局增加 50 / 80
    engine.feedSnapshot(
      {
        uploadTotal: 5050,
        downloadTotal: 10080,
        connections: []
      },
      baseTime,
      'instance_A'
    )

    const summary = engine.getSummary('today', baseTime)
    assert.equal(summary.nodes.length, 0) // 无任何虚假连接增量
    assert.equal(summary.unknownUpload, 50)
    assert.equal(summary.unknownDownload, 80)
    assert.equal(summary.totalUpload, 50)
    assert.equal(summary.totalDownload, 80)
    assert.equal(summary.total, 130)
  })

  // 19. 细粒度聚合键：不同 chains 独立记录，同时聚合汇总
  it('19. 细粒度聚合键保持不同链路独立记录并能正确汇总', () => {
    const engine = new TrafficStatsEngine()
    engine.feedSnapshot({ uploadTotal: 0, downloadTotal: 0, connections: [] }, baseTime)

    // c1 和 c2 出口都是 NodeX，最外层都是 GroupMain，但中间经过不同的分组
    engine.feedSnapshot(
      {
        uploadTotal: 100,
        downloadTotal: 200,
        connections: [
          { id: 'c1', upload: 40, download: 80, chains: ['NodeX', 'MidGroupA', 'GroupMain'] } as any,
          { id: 'c2', upload: 60, download: 120, chains: ['NodeX', 'MidGroupB', 'GroupMain'] } as any
        ]
      },
      baseTime + 1000
    )

    const rawData = engine.getRawData()
    const todayStr = formatLocalDate(baseTime + 1000)
    const records = rawData.days[todayStr].records

    // 验证底层 records 分别保存，未被错误折叠
    const key1 = 'NodeX:::GroupMain:::NodeX>MidGroupA>GroupMain'
    const key2 = 'NodeX:::GroupMain:::NodeX>MidGroupB>GroupMain'
    assert.ok(records[key1])
    assert.ok(records[key2])
    assert.equal(records[key1].upload, 40)
    assert.equal(records[key2].upload, 60)

    // 验证 getSummary 正确按 Node 和 Group 聚合
    const summary = engine.getSummary('today', baseTime + 1000)
    const nodeX = summary.nodes.find((n) => n.name === 'NodeX')!
    assert.equal(nodeX.upload, 100) // 40 + 60
    assert.equal(nodeX.download, 200) // 80 + 120

    const groupMain = summary.groups.find((g) => g.name === 'GroupMain')!
    assert.equal(groupMain.upload, 100)
    assert.equal(groupMain.download, 200)
  })

  // 20. 本次运行（session）统计：独立于磁盘历史、支持跨日持续累积、可被 clear 重置
  it('20. 本次运行（session）统计：独立于磁盘历史、支持跨日持续累积、可被 clear 重置', () => {
    const todayStr = formatLocalDate(baseTime)
    // 假设磁盘中已有历史流量（今天早些时候产生的 500/1000 流量）
    const initialData = {
      checkpoint: {
        lastCoreUploadTotal: 0,
        lastCoreDownloadTotal: 0,
        lastTimestamp: 0
      },
      days: {
        [todayStr]: {
          day: todayStr,
          uploadTotal: 500,
          downloadTotal: 1000,
          attributedUpload: 500,
          attributedDownload: 1000,
          rawGlobalUpload: 500,
          rawGlobalDownload: 1000,
          unknownUpload: 0,
          unknownDownload: 0,
          records: {
            'OldNode:::OldGroup:::OldNode>OldGroup': {
              node: 'OldNode',
              group: 'OldGroup',
              chains: ['OldNode', 'OldGroup'],
              upload: 500,
              download: 1000
            }
          }
        }
      }
    }

    const engine = new TrafficStatsEngine(initialData)

    // 1. 启动建立基准
    engine.feedSnapshot({ uploadTotal: 100, downloadTotal: 200, connections: [] }, baseTime)

    // 本次内核运行包含首次采样前内核已产生的流量
    let sessionSummary = engine.getSummary('session', baseTime)
    assert.equal(sessionSummary.total, 300)
    assert.equal(sessionSummary.nodes.length, 0)

    // 今日统计此时应包含历史的 1500 (500+1000)
    const todaySummary = engine.getSummary('today', baseTime)
    assert.equal(todaySummary.total, 1500)
    assert.equal(todaySummary.nodes.length, 1)
    assert.equal(todaySummary.nodes[0].name, 'OldNode')

    // 2. 本次运行中产生流量（NodeA 上传 20，下载 40）
    engine.feedSnapshot(
      {
        uploadTotal: 120,
        downloadTotal: 240,
        connections: [
          {
            id: 'c1',
            upload: 20,
            download: 40,
            chains: ['NodeA', 'GroupA']
          } as any
        ]
      },
      baseTime + 1000
    )

    sessionSummary = engine.getSummary('session', baseTime + 1000)
    assert.equal(sessionSummary.totalUpload, 120)
    assert.equal(sessionSummary.totalDownload, 240)
    assert.equal(sessionSummary.total, 360)
    assert.equal(sessionSummary.nodes.length, 1)
    assert.equal(sessionSummary.nodes[0].name, 'NodeA')
    assert.equal(sessionSummary.nodes[0].upload, 20)
    assert.equal(sessionSummary.nodes[0].download, 40)

    // 3. 模拟跨日：运行持续到第二天 (baseTime + 24小时)
    const nextDayTime = baseTime + 24 * 60 * 60 * 1000 + 5000
    engine.feedSnapshot(
      {
        uploadTotal: 150,
        downloadTotal: 300,
        connections: [
          {
            id: 'c1',
            upload: 20,
            download: 40,
            chains: ['NodeA', 'GroupA']
          } as any,
          {
            id: 'c2',
            upload: 30,
            download: 60,
            chains: ['NodeB', 'GroupB']
          } as any
        ]
      },
      nextDayTime
    )

    // 第二天的今日统计仅包含 NodeB (30/60)
    const nextDaySummary = engine.getSummary('today', nextDayTime)
    assert.equal(nextDaySummary.totalUpload, 30)
    assert.equal(nextDaySummary.totalDownload, 60)
    assert.equal(nextDaySummary.nodes.length, 1)
    assert.equal(nextDaySummary.nodes[0].name, 'NodeB')

    // 跨日仍包含内核初始累计量和 NodeA、NodeB 的后续增量
    sessionSummary = engine.getSummary('session', nextDayTime)
    assert.equal(sessionSummary.totalUpload, 150)
    assert.equal(sessionSummary.totalDownload, 300)
    assert.equal(sessionSummary.total, 450)
    assert.equal(sessionSummary.nodes.length, 2)
    const nodeA = sessionSummary.nodes.find((n) => n.name === 'NodeA')!
    const nodeB = sessionSummary.nodes.find((n) => n.name === 'NodeB')!
    assert.equal(nodeA.upload, 20)
    assert.equal(nodeA.download, 40)
    assert.equal(nodeB.upload, 30)
    assert.equal(nodeB.download, 60)

    // 4. 清空统计：本次运行也被清空为 0
    engine.clear(nextDayTime)
    sessionSummary = engine.getSummary('session', nextDayTime)
    assert.equal(sessionSummary.total, 0)
    assert.equal(sessionSummary.nodes.length, 0)
  })

  // 21. 基于连接的流量统计：按连接记录流量、包含元数据与上下行流量
  it('21. 基于连接的流量统计：记录连接元数据、上下行流量与排序', () => {
    const engine = new TrafficStatsEngine()
    engine.feedSnapshot(
      {
        uploadTotal: 100,
        downloadTotal: 200,
        connections: [
          {
            id: 'conn-1',
            upload: 10,
            download: 20,
            chains: ['NodeUS', 'ProxyGroup'],
            rule: 'Match',
            start: '2026-09-26T12:00:00Z',
            metadata: {
              network: 'tcp',
              host: 'api.github.com',
              destinationIP: '140.82.121.4',
              destinationPort: '443',
              process: 'git.exe',
              processPath: 'C:\\Program Files\\Git\\bin\\git.exe'
            }
          } as any,
          {
            id: 'conn-2',
            upload: 50,
            download: 100,
            chains: ['NodeHK', 'ProxyGroup'],
            rule: 'GeoIP',
            start: '2026-09-26T12:00:01Z',
            metadata: {
              network: 'udp',
              host: 'discord.com',
              destinationIP: '162.159.130.233',
              destinationPort: '50001',
              process: 'Discord.exe',
              processPath: 'C:\\Users\\User\\Discord.exe'
            }
          } as any
        ]
      },
      baseTime
    )

    // 第二次采样增量
    engine.feedSnapshot(
      {
        uploadTotal: 180,
        downloadTotal: 350,
        connections: [
          {
            id: 'conn-1',
            upload: 30, // +20
            download: 70, // +50
            chains: ['NodeUS', 'ProxyGroup'],
            rule: 'Match',
            start: '2026-09-26T12:00:00Z',
            metadata: {
              network: 'tcp',
              host: 'api.github.com',
              destinationIP: '140.82.121.4',
              destinationPort: '443',
              process: 'git.exe',
              processPath: 'C:\\Program Files\\Git\\bin\\git.exe'
            }
          } as any,
          {
            id: 'conn-2',
            upload: 110, // +60
            download: 200, // +100
            chains: ['NodeHK', 'ProxyGroup'],
            rule: 'GeoIP',
            start: '2026-09-26T12:00:01Z',
            metadata: {
              network: 'udp',
              host: 'discord.com',
              destinationIP: '162.159.130.233',
              destinationPort: '50001',
              process: 'Discord.exe',
              processPath: 'C:\\Users\\User\\Discord.exe'
            }
          } as any
        ]
      },
      baseTime + 1000
    )

    const summary = engine.getSummary('today', baseTime + 1000)
    assert.equal(summary.connections.length, 2)

    // conn-2 total = 60 + 100 = 160; conn-1 total = 20 + 50 = 70 -> conn-2 排第一
    assert.equal(summary.connections[0].id, 'conn-2')
    assert.equal(summary.connections[0].destination, 'discord.com:50001')
    assert.equal(summary.connections[0].process, 'Discord.exe')
    assert.equal(summary.connections[0].node, 'NodeHK')
    assert.equal(summary.connections[0].upload, 60)
    assert.equal(summary.connections[0].download, 100)
    assert.equal(summary.connections[0].total, 160)
    assert.equal(summary.connections[0].network, 'udp')

    assert.equal(summary.connections[1].id, 'conn-1')
    assert.equal(summary.connections[1].destination, 'api.github.com:443')
    assert.equal(summary.connections[1].process, 'git.exe')
    assert.equal(summary.connections[1].node, 'NodeUS')
    assert.equal(summary.connections[1].upload, 20)
    assert.equal(summary.connections[1].download, 50)
    assert.equal(summary.connections[1].total, 70)
  })

  // 22. 进程（processes）与域名（hosts）维度聚合统计
  it('22. 进程与域名维度聚合统计', () => {
    const engine = new TrafficStatsEngine()
    engine.feedSnapshot(
      {
        uploadTotal: 100,
        downloadTotal: 100,
        connections: [
          {
            id: 'c1',
            upload: 10,
            download: 10,
            chains: ['Node1', 'Group1'],
            metadata: {
              host: 'example.com',
              destinationPort: '443',
              processPath: '/usr/bin/curl'
            }
          } as any,
          {
            id: 'c2',
            upload: 10,
            download: 10,
            chains: ['Node1', 'Group1'],
            metadata: {
              host: 'example.com',
              destinationPort: '443',
              processPath: '/usr/bin/curl'
            }
          } as any
        ]
      },
      baseTime
    )

    // c1 增量 30/70，c2 增量 20/30
    engine.feedSnapshot(
      {
        uploadTotal: 150,
        downloadTotal: 200,
        connections: [
          {
            id: 'c1',
            upload: 40,
            download: 80,
            chains: ['Node1', 'Group1'],
            metadata: {
              host: 'example.com',
              destinationPort: '443',
              processPath: '/usr/bin/curl'
            }
          } as any,
          {
            id: 'c2',
            upload: 30,
            download: 40,
            chains: ['Node1', 'Group1'],
            metadata: {
              host: 'example.com',
              destinationPort: '443',
              processPath: '/usr/bin/curl'
            }
          } as any
        ]
      },
      baseTime + 1000
    )

    const summary = engine.getSummary('today', baseTime + 1000)
    // 两个连接属于同一个进程 curl 和同一个域名 example.com
    assert.equal(summary.processes.length, 1)
    assert.equal(summary.processes[0].name, 'curl')
    assert.equal(summary.processes[0].upload, 50)
    assert.equal(summary.processes[0].download, 100)
    assert.equal(summary.processes[0].total, 150)

    assert.equal(summary.hosts.length, 1)
    assert.equal(summary.hosts[0].name, 'example.com')
    assert.equal(summary.hosts[0].upload, 50)
    assert.equal(summary.hosts[0].download, 100)
    assert.equal(summary.hosts[0].total, 150)
  })

  // 23. 清空时连接维度和进程域名维度一并重置
  it('23. 清空时连接维度和进程域名维度一并重置', () => {
    const engine = new TrafficStatsEngine()
    engine.feedSnapshot(
      {
        uploadTotal: 10,
        downloadTotal: 10,
        connections: [
          {
            id: 'c1',
            upload: 10,
            download: 10,
            chains: ['Node1'],
            metadata: { host: 'test.com', process: 'test' }
          } as any
        ]
      },
      baseTime
    )
    engine.feedSnapshot(
      {
        uploadTotal: 50,
        downloadTotal: 50,
        connections: [
          {
            id: 'c1',
            upload: 50,
            download: 50,
            chains: ['Node1'],
            metadata: { host: 'test.com', process: 'test' }
          } as any
        ]
      },
      baseTime + 1000
    )

    let summary = engine.getSummary('session', baseTime + 1000)
    assert.equal(summary.connections.length, 1)
    assert.equal(summary.processes.length, 1)
    assert.equal(summary.hosts.length, 1)

    engine.clear(baseTime + 2000)
    summary = engine.getSummary('session', baseTime + 2000)
    assert.equal(summary.connections.length, 0)
    assert.equal(summary.processes.length, 0)
    assert.equal(summary.hosts.length, 0)
  })
})


