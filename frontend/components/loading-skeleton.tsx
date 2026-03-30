"use client";

type LoadingSkeletonProps = {
  className?: string;
};

export function LoadingSkeleton({ className = "" }: LoadingSkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-white/10 bg-white/[0.07] ${className}`}
      aria-hidden="true"
    />
  );
}
