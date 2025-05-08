// ApplicationStats: Dashboard for application statistics
'use client';
import { Card } from '@/components/ui/card';

export function ApplicationStats() {
  // TODO: Fetch stats using TanStack Query
  return (
    <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="p-4 text-center">
        <div className="text-2xl font-bold">12</div>
        <div className="text-muted-foreground">Submitted</div>
      </Card>
      <Card className="p-4 text-center">
        <div className="text-2xl font-bold">5</div>
        <div className="text-muted-foreground">In Progress</div>
      </Card>
      <Card className="p-4 text-center">
        <div className="text-2xl font-bold">3</div>
        <div className="text-muted-foreground">Successes</div>
      </Card>
      {/* TODO: Add charts/graphs here */}
    </div>
  );
}
