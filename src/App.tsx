import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useState, useEffect } from 'react'
import { Pie } from 'react-chartjs-2'
import { Tree, TreeNode } from 'react-organizational-chart'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import * as XLSX from 'xlsx'
import { format, addDays, isValid } from 'date-fns'
import { Calendar as CalendarIcon, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DateRange } from 'react-day-picker'

ChartJS.register(ArcElement, Tooltip, Legend)

// Sample data for the table
const sampleData = [
  { date: '2023-01-01', task: 'Task A', subcategory: 'Sub A', elapsedTime: 1.5, outcome: 'Result A' },
  { date: '2023-01-02', task: 'Task B', subcategory: 'Sub A', elapsedTime: 2.0, outcome: 'Result B' },
  { date: '2023-01-03', task: 'Task C', subcategory: 'Sub A', elapsedTime: 3.0, outcome: 'Result C' },
  { date: '2023-01-04', task: 'Task A', subcategory: 'Sub C', elapsedTime: 1.5, outcome: 'Result A' },
  { date: '2023-01-05', task: 'Task B', subcategory: 'Sub B', elapsedTime: 2.0, outcome: 'Result B' },
  { date: '2023-01-06', task: 'Task C', subcategory: 'Sub B', elapsedTime: 3.0, outcome: 'Result C' },
  { date: '2023-01-07', task: 'Task A', subcategory: 'Sub A', elapsedTime: 1.5, outcome: 'Result A' },
  { date: '2023-01-08', task: 'Task B', subcategory: 'Sub C', elapsedTime: 2.0, outcome: 'Result B' },
  { date: '2023-01-09', task: 'Task C', subcategory: 'Sub B', elapsedTime: 3.0, outcome: 'Result C' },
  { date: '2023-01-10', task: 'Task A', subcategory: 'Sub A', elapsedTime: 1.5, outcome: 'Result A' },
]

// Convert Excel serial date to JavaScript Date object
const convertExcelDate = (serial) => {
  const utc_days = Math.floor(serial - 25569)
  const utc_value = utc_days * 86400
  const date_info = new Date(utc_value * 1000)

  const fractional_day = serial - Math.floor(serial) + 0.0000001

  let total_seconds = Math.floor(86400 * fractional_day)

  const seconds = total_seconds % 60

  total_seconds -= seconds

  const hours = Math.floor(total_seconds / (60 * 60))
  const minutes = Math.floor(total_seconds / 60) % 60

  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds)
}

// Convert Excel serial time to minutes
const convertExcelTime = (serial) => {
  return Math.round(serial * 24 * 60)
}

// Prepare data for Pie Chart A
const preparePieDataA = (data) => {
  const taskTimes = data.reduce((acc, row) => {
    acc[row.task] = (acc[row.task] || 0) + row.elapsedTime
    return acc
  }, {})

  const sortedTaskTimes = Object.entries(taskTimes).sort((a, b) => b[1] - a[1])

  return {
    labels: sortedTaskTimes.map(([task]) => task),
    datasets: [
      {
        data: sortedTaskTimes.map(([, time]) => time),
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
      },
    ],
  }
}

// Prepare data for Pie Chart B
const preparePieDataB = (data, selectedTask) => {
  const subcategoryTimes = data
    .filter(row => row.task === selectedTask)
    .reduce((acc, row) => {
      acc[row.subcategory] = (acc[row.subcategory] || 0) + row.elapsedTime
      return acc
    }, {})

  const sortedSubcategoryTimes = Object.entries(subcategoryTimes).sort((a, b) => b[1] - a[1])

  return {
    labels: sortedSubcategoryTimes.map(([subcategory]) => subcategory),
    datasets: [
      {
        data: sortedSubcategoryTimes.map(([, time]) => time),
        backgroundColor: ['#4BC0C0', '#9966FF', '#FF9F40'],
      },
    ],
  }
}

// Prepare data for Tree Diagram
const prepareTreeData = (data) => {
  return data.reduce((acc, row) => {
    if (!acc[row.task]) {
      acc[row.task] = []
    }
    acc[row.task].push(row.subcategory)
    return acc
  }, {})
}

function App() {
  const [data, setData] = useState(sampleData)
  const [filteredData, setFilteredData] = useState(sampleData)
  const [pieDataA, setPieDataA] = useState(preparePieDataA(sampleData))
  const [pieDataB, setPieDataB] = useState(preparePieDataB(sampleData, 'Task A'))
  const [treeData, setTreeData] = useState(prepareTreeData(sampleData))
  const [selectedTask, setSelectedTask] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(2023, 0, 1),
    to: addDays(new Date(2023, 0, 1), 9),
  })
  const [isExcelUploaded, setIsExcelUploaded] = useState(false)
  const [minimizedCards, setMinimizedCards] = useState({
    pieChartA: false,
    pieChartB: false,
    treeDiagram: false,
    dataTable: false,
  })

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const binaryStr = e.target?.result
        const workbook = XLSX.read(binaryStr, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        const formattedData = jsonData.slice(1).map(row => {
          if (isNaN(row[0]) || isNaN(row[3])) {
            console.error('Invalid time value:', row)
            return null
          }
          const date = convertExcelDate(row[0])
          if (!isValid(date)) {
            console.error('Invalid date value:', row)
            return null
          }
          return {
            date: format(date, 'yyyy/MM/dd'),
            task: row[1],
            subcategory: row[2],
            elapsedTime: convertExcelTime(row[3]),
            outcome: row[4],
            serialDate: row[0]
          }
        }).filter(row => row !== null)
        setData(formattedData as any)
        setFilteredData(formattedData as any)
        setPieDataA(preparePieDataA(formattedData))
        setPieDataB(preparePieDataB(formattedData, formattedData[0]?.task || 'Task A'))
        setTreeData(prepareTreeData(formattedData))
        setSelectedTask(formattedData[0]?.task || '')
        setIsExcelUploaded(true)

        const serialDates = formattedData.map(row => row.serialDate).filter(isValid)
        const minSerialDate = Math.min(...serialDates)
        const maxSerialDate = Math.max(...serialDates)
        setDateRange({ from: convertExcelDate(minSerialDate), to: convertExcelDate(maxSerialDate) })
      }
      reader.readAsBinaryString(file)
    }
  }

  useEffect(() => {
    setPieDataB(preparePieDataB(filteredData, selectedTask || 'Task A'))
  }, [selectedTask, filteredData])

  const handleFilter = () => {
    const dataToFilter = isExcelUploaded ? data : sampleData
    const endDate = dateRange?.to ? new Date(dateRange.to.setHours(23, 59, 59, 999)) : undefined
    const filteredData = dataToFilter.filter(row => {
      const rowDate = isExcelUploaded ? convertExcelDate(row.serialDate) : new Date(row.date)
      return dateRange?.from && endDate
        ? rowDate >= dateRange.from && rowDate <= endDate
        : dateRange?.from
        ? rowDate.toDateString() === dateRange.from.toDateString()
        : true
    })
    setFilteredData(filteredData)
    setPieDataA(preparePieDataA(filteredData))
    setPieDataB(preparePieDataB(filteredData, selectedTask || 'Task A'))
    setTreeData(prepareTreeData(filteredData))
  }

  const uniqueTasks = Array.from(new Set(data.map(row => row.task)))

  const toggleMinimize = (card) => {
    setMinimizedCards(prevState => ({
      ...prevState,
      [card]: !prevState[card]
    }))
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">BI Dashboard</h1>
      </header>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Upload Excel File, Select Task & Filter by Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <Input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="mb-4" />
          <div className="mb-4">
            <Select onValueChange={setSelectedTask}>
              <SelectTrigger>
                <span>{selectedTask || 'Select a task'}</span>
              </SelectTrigger>
              <SelectContent>
                {uniqueTasks.map((task, index) => (
                  <SelectItem key={index} value={task}>
                    {task}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex space-x-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[300px] justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            <Button onClick={handleFilter}>Filter</Button>
          </div>
        </CardContent>
      </Card>
      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Pie Chart A</CardTitle>
            <Button onClick={() => toggleMinimize('pieChartA')} className="ml-auto">
              {minimizedCards.pieChartA ? <Plus size={16} /> : <Minus size={16} />}
            </Button>
          </CardHeader>
          {!minimizedCards.pieChartA && (
            <CardContent>
              <Pie data={pieDataA} />
            </CardContent>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Pie Chart B</CardTitle>
            <Button onClick={() => toggleMinimize('pieChartB')} className="ml-auto">
              {minimizedCards.pieChartB ? <Plus size={16} /> : <Minus size={16} />}
            </Button>
          </CardHeader>
          {!minimizedCards.pieChartB && (
            <CardContent>
              <Pie data={pieDataB} />
            </CardContent>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Tree Diagram</CardTitle>
            <Button onClick={() => toggleMinimize('treeDiagram')} className="ml-auto">
              {minimizedCards.treeDiagram ? <Plus size={16} /> : <Minus size={16} />}
            </Button>
          </CardHeader>
          {!minimizedCards.treeDiagram && (
            <CardContent className="max-h-96 overflow-auto">
              <Tree
                lineWidth={'2px'}
                lineColor={'#ddd'}
                lineBorderRadius={'10px'}
                label={<div className="bg-gray-200 p-2 rounded">Tasks</div>}
              >
                {Object.entries(treeData).map(([task, subcategories], index) => {
                  const filteredSubcategories = subcategories.filter(sub => sub !== 'none')
                  return (
                    (filteredSubcategories.length > 0 || subcategories.every(sub => sub === 'none')) && (
                      <TreeNode key={index} label={<div className="bg-gray-200 p-2 rounded">{task}</div>}>
                        {filteredSubcategories.length > 0
                          ? Array.from(new Set(filteredSubcategories)).map((subcategory, subIndex) => (
                              <TreeNode key={subIndex} label={<div className="bg-gray-200 p-2 rounded">{subcategory}</div>} />
                            ))
                          : null}
                      </TreeNode>
                    )
                  )
                })}
              </Tree>
            </CardContent>
          )}
        </Card>
        <Card className="col-span-1 md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Data Table</CardTitle>
            <Button onClick={() => toggleMinimize('dataTable')} className="ml-auto">
              {minimizedCards.dataTable ? <Plus size={16} /> : <Minus size={16} />}
            </Button>
          </CardHeader>
          {!minimizedCards.dataTable && (
            <CardContent className="max-h-96 overflow-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr>
                    <th className="py-2 px-4 border-b">Date</th>
                    <th className="py-2 px-4 border-b">Task</th>
                    <th className="py-2 px-4 border-b">Subcategory</th>
                    <th className="py-2 px-4 border-b">Elapsed Time</th>
                    <th className="py-2 px-4 border-b">Outcome</th>
                  </tr>
                </thead>
                <tbody className="max-h-96 overflow-auto">
                  {filteredData.map((row, index) => (
                    <tr key={index}>
                      <td className="py-2 px-4 border-b">{row.date}</td>
                      <td className="py-2 px-4 border-b">{row.task}</td>
                      <td className="py-2 px-4 border-b">{row.subcategory}</td>
                      <td className="py-2 px-4 border-b">{row.elapsedTime} minutes</td>
                      <td className="py-2 px-4 border-b">{row.outcome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  )
}

export default App