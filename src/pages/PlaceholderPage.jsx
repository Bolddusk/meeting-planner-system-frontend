import PageHero from '@/components/ui/PageHero'
import Card, { CardBody } from '@/components/ui/Card'
import { Construction } from 'lucide-react'

export default function PlaceholderPage({ title, description, eyebrow }) {
  return (
    <div className="space-y-6">
      <PageHero eyebrow={eyebrow} title={title} description={description} />
      <Card>
        <CardBody className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100">
            <Construction className="h-8 w-8 text-primary-700" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Coming soon</h3>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            This page will be wired to the backend API in the next development milestone.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
