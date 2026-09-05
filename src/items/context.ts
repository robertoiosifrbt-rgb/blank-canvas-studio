import { useOutletContext } from 'react-router-dom'

import type { Item } from '../repository/items'
import type { ItemsHandle } from './useItems'

/** What every screen inside the shell receives. */
export type ScreenContext = {
  data: ItemsHandle
  /** Opens the item sheet. Not a new screen — the same sheet everywhere. */
  openItem: (item: Item) => void
  /** Today, from the device clock. */
  today: string
  /**
   * Opens the sheet for the tax and NI percentages.
   *
   * It lives here rather than on a button of its own: the bar has room for
   * three screens and the header for two tools, and a fourth of either pushed
   * the narrowest phone into scrolling before it could show anything.
   */
  openReserves: () => void
}

export function useScreen(): ScreenContext {
  return useOutletContext<ScreenContext>()
}
