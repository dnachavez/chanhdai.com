export type Gear = {
  /**
   * Product name shown as the card title.
   */
  name: string
  /**
   * Short spec line shown beneath the name (e.g., "16GB memory · 512GB SSD").
   */
  description: string
  /**
   * Grouping label used to bucket items into sections (e.g., "Computers").
   * Items are rendered in the order categories first appear in the data.
   */
  category: string
  /**
   * Product photo path under /public (e.g., "/images/gear/macbook-pro.jpg").
   */
  image: string
  /**
   * Optional external link (product/purchase page). Renders an arrow affordance.
   */
  link?: string
}
