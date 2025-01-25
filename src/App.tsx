import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useState, useEffect } from 'react'
import { Pie, Bar } from 'react-chartjs-2'
import { Tree, TreeNode } from 'react-organizational-chart'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import * as XLSX from 'xlsx'
import { format, addDays, isValid } from 'date-fns'
import { Calendar as CalendarIcon, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DateRange } from 'react-day-picker'

ChartJS.register(ArcElement, BarElement, Tooltip, Legend, CategoryScale, LinearScale, ChartDataLabels)

// Sample data for the table
const sampleData = [
  { date: '2023-01-01', project: 'Project A', task: 'Task A', subtask: 'Sub A', plan: 'Plan A', elapsedTime: 1.5, progress: '50%' },
  { date: '2023-01-02', project: 'Project A', task: 'Task B', subtask: 'Sub A', plan: 'Plan B', elapsedTime: 2.0, progress: '60%' },
  { date: '2023-01-03', project: 'Project C', task: 'Task C', subtask: 'Sub A', plan: 'Plan C', elapsedTime: 3.0, progress: '70%' },
  { date: '2023-01-04', project: 'Project A', task: 'Task A', subtask: 'Sub C', plan: 'Plan A', elapsedTime: 1.5, progress: '80%' },
  { date: '2023-01-05', project: 'Project B', task: 'Task B', subtask: 'Sub B', plan: 'Plan B', elapsedTime: 2.0, progress: '90%' },
  { date: '2023-01-06', project: 'Project C', task: 'Task C', subtask: 'Sub B', plan: 'Plan C', elapsedTime: 3.0, progress: '100%' },
  { date: '2023-01-07', project: 'Project A', task: 'Task A', subtask: 'Sub A', plan: 'Plan A', elapsedTime: 1.5, progress: '50%' },
  { date: '2023-01-08', project: 'Project B', task: 'Task B', subtask: 'Sub C', plan: 'Plan B', elapsedTime: 2.0, progress: '60%' },
  { date: '2023-01-09', project: 'Project A', task: 'Task C', subtask: 'Sub B', plan: 'Plan C', elapsedTime: 3.0, progress: '70%' },
  { date: '2023-01-10', project: 'Project A', task: 'Task A', subtask: 'Sub A', plan: 'Plan A', elapsedTime: 1.5, progress: '80%' },
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

// Convert Excel serial time to hours
const convertExcelTime = (serial) => {
  return (serial * 24).toFixed(2)
}

// Prepare data for Pie Chart A
const preparePieDataA = (data, selectedProject) => {
  const taskTimes = data
    .filter(row => row.project === selectedProject)
    .reduce((acc, row) => {
      acc[row.task] = (acc[row.task] || 0) + parseFloat(row.elapsedTime)
      return acc
    }, {})

  const sortedTaskTimes = Object.entries(taskTimes).sort((a, b) => b[1] - a[1])

  const colors = sortedTaskTimes.length <= 6
    ? ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
    : [
        '#FF6384', '#FF33A2', '#FF008C', '#FF5733', '#FF8C00', '#FFD700', 
        '#FFCE56', '#8CFF00', '#33FF57', '#00FF8C', '#4BC0C0', '#00D7FF', 
        '#36A2EB', '#3357FF', '#008CFF', '#9966FF', '#A233FF', '#8C00FF', 
        '#33FFA2', '#FF9F40'
      ]

  return {
    labels: sortedTaskTimes.map(([task]) => task),
    datasets: [
      {
        data: sortedTaskTimes.map(([, time]) => time),
        backgroundColor: colors.slice(0, sortedTaskTimes.length),
      },
    ],
  }
}

// Prepare data for Pie Chart B
const preparePieDataB = (data, selectedTask) => {
  const subcategoryTimes = data
    .filter(row => row.task === selectedTask)
    .reduce((acc, row) => {
      acc[row.subtask] = (acc[row.subtask] || 0) + parseFloat(row.elapsedTime)
      return acc
    }, {})

  const sortedSubcategoryTimes = Object.entries(subcategoryTimes).sort((a, b) => b[1] - a[1])

  const colors = sortedSubcategoryTimes.length <= 6
    ? ['#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#36A2EB', '#FFCE56']
    : [
        '#4BC0C0', '#00D7FF', '#36A2EB', '#3357FF', '#008CFF', '#9966FF', 
        '#A233FF', '#8C00FF', '#33FFA2', '#FF9F40', '#FF6384', '#FF33A2', 
        '#FF008C', '#FF5733', '#FF8C00', '#FFD700', '#FFCE56', '#8CFF00', 
        '#33FF57', '#00FF8C'
      ]

  return {
    labels: sortedSubcategoryTimes.map(([subtask]) => subtask),
    datasets: [
      {
        data: sortedSubcategoryTimes.map(([, time]) => time),
        backgroundColor: colors.slice(0, sortedSubcategoryTimes.length),
      },
    ],
  }
}

// Prepare data for Pie Chart Project Breakdown
const preparePieDataProject = (data) => {
  const projectTimes = data.reduce((acc, row) => {
    acc[row.project] = (acc[row.project] || 0) + parseFloat(row.elapsedTime)
    return acc
  }, {})

  const sortedProjectTimes = Object.entries(projectTimes).sort((a, b) => b[1] - a[1])

  const colors = sortedProjectTimes.length <= 6
    ? ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
    : [
        '#FF6384', '#FF33A2', '#FF008C', '#FF5733', '#FF8C00', '#FFD700', 
        '#FFCE56', '#8CFF00', '#33FF57', '#00FF8C', '#4BC0C0', '#00D7FF', 
        '#36A2EB', '#3357FF', '#008CFF', '#9966FF', '#A233FF', '#8C00FF', 
        '#33FFA2', '#FF9F40'
      ]

  return {
    labels: sortedProjectTimes.map(([project]) => project),
    datasets: [
      {
        data: sortedProjectTimes.map(([, time]) => time),
        backgroundColor: colors.slice(0, sortedProjectTimes.length),
      },
    ],
  }
}

// Prepare data for Bar Chart
const prepareBarData = (data, type, selectedProject, selectedTask) => {
  let filteredData = data
  if (type === 'task' && selectedProject) {
    filteredData = data.filter(row => row.project === selectedProject)
  } else if (type === 'subtask' && selectedTask) {
    filteredData = data.filter(row => row.task === selectedTask)
  }

  const times = filteredData.reduce((acc, row) => {
    const key = type === 'project' ? row.project : type === 'task' ? row.task : row.subtask
    acc[key] = (acc[key] || 0) + parseFloat(row.elapsedTime)
    return acc
  }, {})

  const sortedTimes = Object.entries(times).sort((a, b) => b[1] - a[1])

  return {
    labels: sortedTimes.map(([key]) => key),
    datasets: [
      {
        label: 'Elapsed Time (hours)',
        data: sortedTimes.map(([, time]) => time),
        backgroundColor: '#36A2EB',
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
    acc[row.task].push(row.subtask)
    return acc
  }, {})
}

const pieOptions = {
  plugins: {
    legend: {
      position: 'right',
    },
    tooltip: {
      callbacks: {
        label: function (context) {
          const label = context.label || ''
          const value = context.raw || 0
          return `${label}: ${value.toFixed(2)} hours`
        },
      },
    },
  },
}

const barOptions = {
  plugins: {
    datalabels: {
      anchor: 'end',
      align: 'end',
      formatter: (value) => value.toFixed(2),
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: 'Elapsed Time (hours)',
      },
    },
  },
}

function App() {
  const [data, setData] = useState(sampleData)
  const [filteredData, setFilteredData] = useState(sampleData)
  const [pieDataProject, setPieDataProject] = useState(preparePieDataProject(sampleData))
  const [pieDataA, setPieDataA] = useState(preparePieDataA(sampleData, 'Project A'))
  const [pieDataB, setPieDataB] = useState(preparePieDataB(sampleData, 'Task A'))
  const [barData, setBarData] = useState(prepareBarData(sampleData, 'project'))
  const [treeData, setTreeData] = useState(prepareTreeData(sampleData))
  const [selectedProject, setSelectedProject] = useState('Project A')
  const [selectedTask, setSelectedTask] = useState('Task A')
  const [barChartType, setBarChartType] = useState('project')
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(2023, 0, 1),
    to: addDays(new Date(2023, 0, 1), 9),
  })
  const [isExcelUploaded, setIsExcelUploaded] = useState(false)
  const [minimizedCards, setMinimizedCards] = useState({
    pieChartProject: false,
    pieChartA: false,
    pieChartB: false,
    barChart: false,
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
          if (isNaN(row[0]) || isNaN(row[5])) {
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
            project: row[1],
            task: row[2],
            subtask: row[3],
            plan: row[4],
            elapsedTime: convertExcelTime(row[5]),
            progress: row[6],
            serialDate: row[0]
          }
        }).filter(row => row !== null)
        setData(formattedData as any)
        setFilteredData(formattedData as any)
        setPieDataProject(preparePieDataProject(formattedData))
        setPieDataA(preparePieDataA(formattedData, formattedData[0]?.project || 'Project A'))
        setPieDataB(preparePieDataB(formattedData, formattedData[0]?.task || 'Task A'))
        setBarData(prepareBarData(formattedData, barChartType, selectedProject, selectedTask))
        setTreeData(prepareTreeData(formattedData))
        setSelectedProject(formattedData[0]?.project || 'Project A')
        setSelectedTask(formattedData[0]?.task || 'Task A')
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
    setPieDataA(preparePieDataA(filteredData, selectedProject))
    setSelectedTask(filteredData.find(row => row.project === selectedProject)?.task || '')
  }, [selectedProject, filteredData])

  useEffect(() => {
    setPieDataB(preparePieDataB(filteredData, selectedTask || 'Task A'))
  }, [selectedTask, filteredData])

  useEffect(() => {
    setBarData(prepareBarData(filteredData, barChartType, selectedProject, selectedTask))
  }, [filteredData, barChartType, selectedProject, selectedTask])

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
    setPieDataProject(preparePieDataProject(filteredData))
    setPieDataA(preparePieDataA(filteredData, selectedProject))
    setPieDataB(preparePieDataB(filteredData, selectedTask || 'Task A'))
    setBarData(prepareBarData(filteredData, barChartType, selectedProject, selectedTask))
    setTreeData(prepareTreeData(filteredData))
  }

  const uniqueProjects = Array.from(new Set(data.map(row => row.project)))
  const uniqueTasks = Array.from(new Set(data.filter(row => row.project === selectedProject).map(row => row.task)))

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
          <CardTitle className="text-xl font-semibold">Upload Excel File & Filter by Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <Input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="mb-4" />
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
            <CardTitle className="text-xl font-semibold">Project Breakdown</CardTitle>
            <Button onClick={() => toggleMinimize('pieChartProject')} className="ml-auto">
              {minimizedCards.pieChartProject ? <Plus size={16} /> : <Minus size={16} />}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="mb-4" style={{ height: '20px' }}></div> {/* Placeholder */}
            <Pie data={pieDataProject} options={pieOptions} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Task Breakdown</CardTitle>
            <Button onClick={() => toggleMinimize('pieChartA')} className="ml-auto">
              {minimizedCards.pieChartA ? <Plus size={16} /> : <Minus size={16} />}
            </Button>
          </CardHeader>
          <CardContent>
            <Select onValueChange={setSelectedProject} defaultValue={selectedProject}>
              <SelectTrigger>
                <span>{selectedProject || 'Select a project'}</span>
              </SelectTrigger>
              <SelectContent>
                {uniqueProjects.map((project, index) => (
                  <SelectItem key={index} value={project}>
                    {project}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Pie data={pieDataA} options={pieOptions} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Subtask Breakdown</CardTitle>
            <Button onClick={() => toggleMinimize('pieChartB')} className="ml-auto">
              {minimizedCards.pieChartB ? <Plus size={16} /> : <Minus size={16} />}
            </Button>
          </CardHeader>
          <CardContent>
            <Select onValueChange={setSelectedTask} defaultValue={selectedTask}>
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
            <Pie data={pieDataB} options={pieOptions} />
          </CardContent>
        </Card>
        <Card className="col-span-1 md:col-span-2 lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Elapsed Time Bar Chart</CardTitle>
            <Button onClick={() => toggleMinimize('barChart')} className="ml-auto">
              {minimizedCards.barChart ? <Plus size={16} /> : <Minus size={16} />}
            </Button>
          </CardHeader>
          {!minimizedCards.barChart && (
            <CardContent>
              <Select onValueChange={setBarChartType} defaultValue={barChartType}>
                <SelectTrigger>
                  <span>{barChartType || 'Select a type'}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="subtask">Subtask</SelectItem>
                </SelectContent>
              </Select>
              <Bar data={barData} options={barOptions} />
            </CardContent>
          )}
        </Card>
        <Card className="col-span-1 md:col-span-2 lg:col-span-3">
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
                    <th className="py-2 px-4 border-b">Project</th>
                    <th className="py-2 px-4 border-b">Task</th>
                    <th className="py-2 px-4 border-b">Subtask</th>
                    <th className="py-2 px-4 border-b">Plan</th>
                    <th className="py-2 px-4 border-b">Elapsed Time</th>
                    <th className="py-2 px-4 border-b">Progress</th>
                  </tr>
                </thead>
                <tbody className="max-h-96 overflow-auto">
                  {filteredData.map((row, index) => (
                    <tr key={index}>
                      <td className="py-2 px-4 border-b">{row.date}</td>
                      <td className="py-2 px-4 border-b">{row.project}</td>
                      <td className="py-2 px-4 border-b">{row.task}</td>
                      <td className="py-2 px-4 border-b">{row.subtask}</td>
                      <td className="py-2 px-4 border-b">{row.plan}</td>
                      <td className="py-2 px-4 border-b">{parseFloat(row.elapsedTime).toFixed(2)} hours</td>
                      <td className="py-2 px-4 border-b">{row.progress}</td>
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