import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { stats } = await req.json()

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not set in environment' }, { status: 500 })
  }

  const prompt = `You are a financial advisor. Analyze this data and return ONLY a JSON array of 3 insights, no other text:
  Revenue: ${stats.totalRevenue}, Expenses: ${stats.totalExpenses}, Net Profit: ${stats.netProfit}, Cash: ${stats.cashBalance}, AR: ${stats.accountsReceivable}, AP: ${stats.accountsPayable}
  Format: [{"title":"...","description":"...","severity":"info|warning|positive|critical","type":"suggestion"}]`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 }
      })
    }
  )

  const data = await response.json()
  console.log('Gemini response:', JSON.stringify(data))

  if (data.error) {
    return NextResponse.json({ error: data.error.message }, { status: 500 })
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const clean = text.replace(/```json|```/g, '').trim()

  try {
    const parsed = JSON.parse(clean)
    return NextResponse.json({ insights: parsed })
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw: text }, { status: 500 })
  }
}
