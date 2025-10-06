import EmptyState from '../EmptyState'
import { FolderOpen } from 'lucide-react'

export default function EmptyStateExample() {
  return (
    <div className="p-6">
      <EmptyState
        icon={FolderOpen}
        title="No cases yet"
        description="Start by creating your first attendance note from a meeting recording"
        actionLabel="Create New Note"
        onAction={() => console.log('Create new note clicked')}
      />
    </div>
  )
}
