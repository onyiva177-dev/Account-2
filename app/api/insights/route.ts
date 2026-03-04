import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { stats } = await req.json()

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are a financial advisor. Analyze this data and return ONLY a JSON array of 3 insights, no other text:
        Revenue: ${stats.totalRevenue}, Expenses: ${stats.totalExpenses}, Net Profit: ${stats.netProfit}, Cash: ${stats.cashBalance}, AR: ${stats.accountsReceivable}, AP: ${stats.accountsPayable}
        Format: [{"title":"...","description":"...","severity":"info|warning|positive|critical","type":"suggestion"}]`
      }]
    })
  })

  const data = await response.json()
  return NextResponse.json(data)
}
