<template>
  <div class="stats-page">
    <header class="stats-header">
      <button class="back" @click="goBack">‹ 返回对话</button>
      <h1 class="stats-title">数据统计</h1>
    </header>

    <section class="stat-cards">
      <div class="stat-card">
        <span class="stat-value">{{ stats.totalConversations }}</span>
        <span class="stat-label">总对话数</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.totalMessages }}</span>
        <span class="stat-label">总消息数</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.todayMessages }}</span>
        <span class="stat-label">今日消息</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.activeDays }}</span>
        <span class="stat-label">活跃天数</span>
      </div>
    </section>

    <div v-if="!hasData" class="empty-tip">暂无数据</div>

    <section class="chart-row">
      <div class="chart-box">
        <h2 class="chart-title">近 7 天消息量趋势</h2>
        <div ref="lineChartRef" class="chart-placeholder"></div>
      </div>
      <div class="chart-box">
        <h2 class="chart-title">热门话题分布</h2>
        <div ref="pieChartRef" class="chart-placeholder"></div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { fetchStats } from '@/api/stats'

const router = useRouter()

const lineChartRef = ref(null)
const pieChartRef = ref(null)
const hasData = ref(false)

const stats = reactive({
  totalConversations: 0,
  totalMessages: 0,
  todayMessages: 0,
  activeDays: 0,
})

let lineChart = null
let pieChart = null

const starryColors = ['#6366f1', '#818cf8', '#a78bfa', '#7c3aed', '#4f46e5', '#8b5cf6']

const axisStyle = {
  axisLine: { lineStyle: { color: 'rgba(129, 140, 248, 0.4)' } },
  axisLabel: { color: '#94a3b8' },
  splitLine: { lineStyle: { color: 'rgba(129, 140, 248, 0.15)' } },
}

function initLineChart(labels, counts) {
  if (!lineChartRef.value) return
  lineChart = echarts.init(lineChartRef.value)
  lineChart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      borderColor: 'rgba(129, 140, 248, 0.4)',
      textStyle: { color: '#e2e8f0' },
    },
    grid: { left: 48, right: 24, top: 24, bottom: 36 },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
      ...axisStyle,
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      ...axisStyle,
    },
    series: [
      {
        type: 'line',
        data: counts,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: {
          width: 3,
          color: '#818cf8',
        },
        itemStyle: {
          color: '#a78bfa',
          borderColor: '#4338ca',
          borderWidth: 2,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(129, 140, 248, 0.35)' },
            { offset: 1, color: 'rgba(67, 56, 202, 0.05)' },
          ]),
        },
      },
    ],
  })
}

function initPieChart(topicData) {
  if (!pieChartRef.value) return
  pieChart = echarts.init(pieChartRef.value)
  pieChart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      borderColor: 'rgba(129, 140, 248, 0.4)',
      textStyle: { color: '#e2e8f0' },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      right: 16,
      top: 'center',
      textStyle: { color: '#94a3b8' },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '68%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: 'rgba(11, 16, 38, 0.8)',
          borderWidth: 2,
        },
        label: {
          color: '#c7d2fe',
          formatter: '{b}\n{d}%',
        },
        labelLine: {
          lineStyle: { color: 'rgba(129, 140, 248, 0.5)' },
        },
        data: topicData.map((item, index) => ({
          ...item,
          itemStyle: { color: starryColors[index % starryColors.length] },
        })),
        emphasis: {
          scaleSize: 8,
          itemStyle: {
            shadowBlur: 12,
            shadowColor: 'rgba(99, 102, 241, 0.5)',
          },
        },
      },
    ],
  })
}

function initEmptyCharts() {
  const emptyLabels = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - i)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    emptyLabels.push(`${month}-${day}`)
  }

  initLineChart(emptyLabels, [0, 0, 0, 0, 0, 0, 0])
  initPieChart([{ name: '暂无数据', value: 1 }])
}

const handleResize = () => {
  lineChart?.resize()
  pieChart?.resize()
}

function goBack() {
  router.push('/chat')
}

async function loadStats() {
  try {
    const data = await fetchStats()

    stats.totalConversations = data.totalConversations ?? 0
    stats.totalMessages = data.totalMessages ?? 0
    stats.todayMessages = data.todayMessages ?? 0
    stats.activeDays = data.activeDays ?? 0

    const labels = data.last7Days?.labels ?? []
    const counts = data.last7Days?.counts ?? []
    const topTopics = data.topTopics ?? []

    hasData.value = stats.totalConversations > 0 || stats.totalMessages > 0

    if (hasData.value) {
      initLineChart(labels, counts)
      initPieChart(topTopics.length > 0 ? topTopics : [{ name: '暂无数据', value: 1 }])
    } else {
      initEmptyCharts()
    }
  } catch (error) {
    console.error('加载统计数据失败', error)
    hasData.value = false
    initEmptyCharts()
  }
}

onMounted(() => {
  loadStats()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  lineChart?.dispose()
  pieChart?.dispose()
  lineChart = null
  pieChart = null
})
</script>

<style scoped>
* {
  box-sizing: border-box;
}

.stats-page {
  min-height: 100vh;
  padding: 24px;
  color: #f1f5f9;
  font-family: -apple-system, 'Segoe UI', 'PingFang SC', sans-serif;
  background-color: #0b1026;
  background-image:
    radial-gradient(1px 1px at 20% 30%, #fff 50%, transparent),
    radial-gradient(1px 1px at 60% 70%, #cbd5ff 50%, transparent),
    radial-gradient(1.5px 1.5px at 80% 20%, #fff 50%, transparent),
    radial-gradient(1px 1px at 35% 85%, #a5b4fc 50%, transparent),
    radial-gradient(1px 1px at 90% 60%, #fff 50%, transparent);
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}

.back {
  border: none;
  background: rgba(99, 102, 241, 0.2);
  color: #c7d2fe;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.back:hover {
  background: rgba(99, 102, 241, 0.35);
}

.stats-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px;
  border-radius: 14px;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(129, 140, 248, 0.25);
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #fff;
}

.stat-label {
  font-size: 14px;
  color: #94a3b8;
}

.empty-tip {
  margin-bottom: 16px;
  padding: 12px 16px;
  border-radius: 10px;
  text-align: center;
  color: #94a3b8;
  background: rgba(99, 102, 241, 0.1);
  border: 1px dashed rgba(129, 140, 248, 0.35);
}

.chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.chart-box {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  border-radius: 14px;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(129, 140, 248, 0.25);
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #f1f5f9;
}

.chart-placeholder {
  height: 320px;
  border-radius: 10px;
}

@media (max-width: 768px) {
  .stat-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart-row {
    grid-template-columns: 1fr;
  }
}
</style>
