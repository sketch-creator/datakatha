import * as React from 'react'
import { Tabs as T } from 'radix-ui'
import { cn } from '@/lib/utils'

const Tabs = T.Root
function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn('bg-muted/60 text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]', className)} {...props} />
}
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer hover:text-foreground data-[state=active]:shadow-sm [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}
const TabsContent = T.Content

export { Tabs, TabsList, TabsTrigger, TabsContent }
