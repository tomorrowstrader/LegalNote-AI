import CaseCard from '../CaseCard'

export default function CaseCardExample() {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 p-6">
      <CaseCard
        id="1"
        title="Estate Planning Consultation"
        clientName="Mrs. Catherine Williams"
        meetingDate="14 January 2025"
        status="completed"
        createdBy="Sarah Johnson"
      />
      <CaseCard
        id="2"
        title="Contract Review Meeting"
        clientName="ABC Corporation Ltd"
        meetingDate="12 January 2025"
        status="processing"
        createdBy="Michael Brown"
      />
      <CaseCard
        id="3"
        title="Family Law Initial Consultation"
        clientName="Mr. David Thompson"
        meetingDate="10 January 2025"
        status="completed"
        createdBy="Emma Davis"
      />
    </div>
  )
}
