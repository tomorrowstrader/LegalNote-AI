import StatsCard from '../StatsCard'
import { FileText } from 'lucide-react'

export default function StatsCardExample() {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3 p-6">
      <StatsCard title="Total Cases" value={42} icon={FileText} description="+3 this week" />
      <StatsCard title="This Month" value={12} icon={FileText} />
      <StatsCard title="Pending" value={5} icon={FileText} description="Awaiting review" />
    </div>
  )
}
