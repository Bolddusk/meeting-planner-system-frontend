import { cn } from '@/utils/cn'

export default function PageHero({ eyebrow, title, description, className }) {
  return (
    <div
      className={cn(
        'rounded-xl bg-gradient-to-r from-primary-800 to-primary-700 px-8 py-7 text-white shadow-md',
        className,
      )}
    >
      {eyebrow && (
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary-200">
          {eyebrow}
        </p>
      )}
      <h2 className="text-2xl font-bold">{title}</h2>
      {description && <p className="mt-2 max-w-3xl text-sm text-primary-100">{description}</p>}
    </div>
  )
}
