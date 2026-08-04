import React from 'react'

export function SkeletonCard({ className = "" }) {
  return (
    <div className={`bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 w-full ${className}`}>
      <div className="flex justify-between items-center mb-6">
        <div className="space-y-2 w-1/3">
          <div className="h-5 bg-slate-200 rounded animate-skeleton-pulse w-3/4"></div>
          <div className="h-3 bg-slate-200 rounded animate-skeleton-pulse w-1/2"></div>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-200 animate-skeleton-pulse"></div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-4 items-center">
            <div className="w-10 h-10 rounded-xl bg-slate-200 animate-skeleton-pulse shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded animate-skeleton-pulse w-1/3"></div>
              <div className="h-2 bg-slate-200 rounded animate-skeleton-pulse w-1/4"></div>
            </div>
            <div className="h-4 bg-slate-200 rounded animate-skeleton-pulse w-1/5"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonDashboardCard() {
  return (
    <div className="bg-gradient-to-br from-savora-900 to-savora-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between border border-savora-800/40 min-h-[190px]">
      <div className="flex justify-between items-start">
        <div className="space-y-3 w-1/2">
          <div className="h-3 bg-white/20 rounded animate-skeleton-pulse-dark w-1/3"></div>
          <div className="h-8 bg-white/20 rounded animate-skeleton-pulse-dark w-3/4"></div>
        </div>
        <div className="w-10 h-10 rounded-full bg-white/20 animate-skeleton-pulse-dark"></div>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-6 bg-white/5 rounded-2xl p-3 border border-white/10">
        <div className="h-10 bg-white/10 rounded animate-skeleton-pulse-dark"></div>
        <div className="h-10 bg-white/10 rounded animate-skeleton-pulse-dark"></div>
      </div>
    </div>
  )
}

export function SkeletonAccountList() {
  return (
    <div className="flex gap-4 overflow-hidden py-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="min-w-[140px] border border-slate-200 rounded-2xl p-3 bg-white shrink-0">
          <div className="h-3 bg-slate-200 rounded animate-skeleton-pulse w-1/2 mb-3"></div>
          <div className="h-5 bg-slate-200 rounded animate-skeleton-pulse w-3/4 mb-2"></div>
          <div className="h-3 bg-slate-200 rounded animate-skeleton-pulse w-1/3"></div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonList({ count = 5 }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 w-full space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <div className="w-10 h-10 rounded-xl bg-slate-200 animate-skeleton-pulse shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded animate-skeleton-pulse w-1/3"></div>
            <div className="h-2 bg-slate-200 rounded animate-skeleton-pulse w-1/4"></div>
          </div>
          <div className="h-4 bg-slate-200 rounded animate-skeleton-pulse w-1/5"></div>
        </div>
      ))}
    </div>
  )
}
