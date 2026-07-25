"use client"

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible"

function Collapsible({ ...props }: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({ ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  )
}

function CollapsibleContent({ ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-content"
      /**
       * A closed panel is unmounted by default, so everything inside it reaches
       * a crawler only through the RSC payload -- which is how the achievement
       * bullets on /experience and /projects ended up absent from the rendered
       * HTML of the very pages built to showcase them. `hidden="until-found"`
       * keeps the markup in the document, and browsers expand the panel when
       * find-in-page matches inside it.
       */
      hiddenUntilFound
      {...props}
    />
  )
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger }
