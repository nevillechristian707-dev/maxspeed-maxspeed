import { createContext, useContext, useState, ReactNode, useMemo } from "react";

interface MonthYearContextType {
  selectedYear: number;
  selectedMonth: number | "all";
  setSelectedYear: (year: number) => void;
  setSelectedMonth: (month: number | "all") => void;
  dateParams: { startDate: string; endDate: string };
}

const MonthYearContext = createContext<MonthYearContextType | undefined>(undefined);

export function MonthYearProvider({ children }: { children: ReactNode }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | "all">(currentMonth);

  const dateParams = useMemo(() => {
    if (selectedMonth === "all") {
      return {
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear}-12-31`
      };
    } else {
      const monthStr = String(selectedMonth).padStart(2, '0');
      const lastDay = new Date(selectedYear, Number(selectedMonth), 0).getDate();
      return {
        startDate: `${selectedYear}-${monthStr}-01`,
        endDate: `${selectedYear}-${monthStr}-${lastDay}`
      };
    }
  }, [selectedYear, selectedMonth]);

  return (
    <MonthYearContext.Provider value={{
      selectedYear,
      selectedMonth,
      setSelectedYear,
      setSelectedMonth,
      dateParams
    }}>
      {children}
    </MonthYearContext.Provider>
  );
}

export function useMonthYear() {
  const context = useContext(MonthYearContext);
  if (context === undefined) {
    throw new Error("useMonthYear must be used within a MonthYearProvider");
  }
  return context;
}
