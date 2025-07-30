import Link from 'next/link'

type Props = {
  id: string
  question: string
  eventTime: string
  poolYes: number
  poolNo: number
}

export default function PredictionCard({
  id,
  question,
  eventTime,
  poolYes,
  poolNo,
}: Props) {
  const total = poolYes + poolNo
  const yesPct = total > 0 ? (poolYes / total) * 100 : 0
  const noPct = 100 - yesPct

  return (
    <Link href={`/trade/${id}?side=yes`}>
      <div className="bg-[#003E37] text-white rounded-xl p-6 space-y-4 shadow-md hover:scale-[1.01] transition cursor-pointer">
        <h2 className="text-xl font-bold leading-snug">{question}</h2>
        <p className="text-sm">
          Ends On {new Date(eventTime).toLocaleString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
        <p className="text-sm font-medium">
          {yesPct.toFixed(1)}% Yes — <strong>{noPct.toFixed(1)}% No</strong>
        </p>

        <div className="h-2 w-full bg-[#E5E5E5] rounded-full overflow-hidden">
          <div className="h-full bg-[#00B89F]" style={{ width: `${yesPct}%` }} />
        </div>

        <div className="flex justify-center gap-4 pt-2">
          <span className="px-6 py-1 border border-white rounded-full font-semibold">Yes</span>
          <span className="px-6 py-1 border border-white rounded-full font-semibold">No</span>
        </div>
      </div>
    </Link>
  )
}
