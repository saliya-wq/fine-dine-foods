import { createContext, useContext, useState } from 'react'

const STORAGE_KEY = 'calista_table'
const TableCtx = createContext(null)

export function TableProvider({ children }) {
  const [table, setTableState] = useState(() => {
    const v = sessionStorage.getItem(STORAGE_KEY)
    return v ? Number(v) : null
  })

  const setTable = (n) => {
    if (n === null || n === undefined || Number.isNaN(Number(n))) {
      sessionStorage.removeItem(STORAGE_KEY)
      setTableState(null)
    } else {
      const num = Number(n)
      sessionStorage.setItem(STORAGE_KEY, String(num))
      setTableState(num)
    }
  }

  return <TableCtx.Provider value={{ table, setTable }}>{children}</TableCtx.Provider>
}

export const useTable = () => useContext(TableCtx)
