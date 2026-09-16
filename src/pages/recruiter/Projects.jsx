// src/pages/recruiter/Projects.jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFolderPlus } from '@fortawesome/free-solid-svg-icons'
import { PageHeader, Card, CardHeader, Tabs } from '../../components/ui/index'
import ProjectsTable from '../../components/ui/ProjectsTable'
import { ProjectMonthlyChart } from '../../components/ui/Charts'
import CreateProjectModal from './CreateProjectModal'
import { recruiterAPI } from '../../api/axios'

export default function RecruiterProjects() {
  const [projects, setProjects] = useState([])
  const [chartProjects, setChartProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalProjects, setTotalProjects] = useState(0)
  const [statusCounts, setStatusCounts] = useState({ pending: 0, completed: 0, hold: 0, cancelled: 0 })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [locationFilter, setLocationFilter] = useState('All')
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' })
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)

  const projectTabs = useMemo(
    () => [
      { id: 'all', label: 'All' },
      { id: 'pending', label: 'Pending' },
      { id: 'completed', label: 'Completed' },
      { id: 'hold', label: 'Hold' },
      { id: 'cancelled', label: 'Cancelled' }
    ],
    []
  )

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        search: searchTerm || undefined,
        from: dateFilter.from || undefined,
        to: dateFilter.to || undefined,
        location: locationFilter !== 'All' ? locationFilter : undefined,
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        offset: (page - 1) * pageSize,
        limit: pageSize
      }

      const response = await recruiterAPI.getProjects(params)
      const data = response.data?.data || {}
      const items = data.items || data.projects || []
      const total = data.total || data.totalCount || data.count || data.meta?.total || data.meta?.totalItems || items.length
      const counts = data.statusCounts || data.meta?.statusCounts || {}

      const parsedStatusCounts = {
        pending: counts.pending ?? 0,
        completed: counts.completed ?? 0,
        hold: counts.hold ?? 0,
        cancelled: counts.cancelled ?? 0
      }

      if (!counts.pending && !counts.completed && !counts.hold && !counts.cancelled) {
        parsedStatusCounts.pending = items.filter((project) => project.status?.toLowerCase() === 'pending').length
        parsedStatusCounts.completed = items.filter((project) => project.status?.toLowerCase() === 'completed').length
        parsedStatusCounts.hold = items.filter((project) => project.status?.toLowerCase() === 'hold').length
        parsedStatusCounts.cancelled = items.filter((project) => project.status?.toLowerCase() === 'cancelled').length
      }

      setProjects(items)
      setTotalProjects(total)
      setStatusCounts(parsedStatusCounts)
    } catch {
      setProjects([])
      setTotalProjects(0)
      setStatusCounts({ pending: 0, completed: 0, hold: 0, cancelled: 0 })
    } finally {
      setLoading(false)
    }
  }, [selectedStatus, searchTerm, locationFilter, dateFilter, page, pageSize])

  const fetchChartProjects = useCallback(async () => {
    try {
      const baseParams = {
        search: searchTerm || undefined,
        from: dateFilter.from || undefined,
        to: dateFilter.to || undefined,
        location: locationFilter !== 'All' ? locationFilter : undefined,
        status: selectedStatus === 'all' ? undefined : selectedStatus,
      }
      const allProjects = []
      const limit = 100
      let offset = 0
      let total = Infinity

      while (offset < total) {
        const response = await recruiterAPI.getProjects({ ...baseParams, offset, limit })
        const data = response.data?.data || {}
        const items = data.items || data.projects || []
        total = data.total || data.totalCount || data.count || data.meta?.total || data.meta?.totalItems || 0

        if (!items.length) break
        allProjects.push(...items)
        offset += items.length

        if (items.length < limit || !total) break
      }

      setChartProjects(allProjects)
    } catch {
      setChartProjects([])
    }
  }, [selectedStatus, searchTerm, locationFilter, dateFilter])

  const handleSearch = useCallback((value) => {
    setSearchTerm(value)
    setPage(1)
  }, [])

  const handleLocationFilter = useCallback((value) => {
    setLocationFilter(value)
    setPage(1)
  }, [])

  const handleDateFilter = useCallback((filter) => {
    setDateFilter(filter)
    setPage(1)
  }, [])

  const handlePageSizeChange = useCallback((size) => {
    setPageSize(size)
    setPage(1)
  }, [])

  const handleEditProject = useCallback((project) => {
    setEditingProject(project)
    setShowCreateProjectModal(true)
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    if (!loading) fetchChartProjects()
  }, [fetchChartProjects, loading])

  const filteredProjects = projects.filter((project) => {
    const statusMatch = selectedStatus === 'all' || project.status?.toLowerCase() === selectedStatus
    if (!statusMatch) return false

    const searchMatch =
      !searchTerm ||
      [project.projectId, project.projectName, project.name, project.location]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase()))

    if (!searchMatch) return false

    const locationMatch = locationFilter === 'All' || project.location === locationFilter
    if (!locationMatch) return false

    if (dateFilter.from || dateFilter.to) {
      const projectDate = new Date(project.startDate || project.createdAt)
      if (dateFilter.from) {
        const fromDate = new Date(dateFilter.from)
        if (projectDate < fromDate) return false
      }
      if (dateFilter.to) {
        const toDate = new Date(dateFilter.to)
        toDate.setHours(23, 59, 59, 999)
        if (projectDate > toDate) return false
      }
    }

    return true
  })

  return (
    <div>
      <PageHeader
        title="Projects"
        action={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreateProjectModal(true)}
          >
            <FontAwesomeIcon icon={faFolderPlus} /> Create Project
          </button>
        }
      />

      <Card style={{ marginBottom: 18 }}>
        <div className="project-summary-grid">
          {[
            { label: 'Total Projects', value: totalProjects },
            { label: 'Pending', value: statusCounts.pending },
            { label: 'Completed', value: statusCounts.completed },
            { label: 'Hold', value: statusCounts.hold }
          ].map((metric) => (
            <div key={metric.label} className="project-summary-card">
              <div className="title">{metric.label}</div>
              <div className="value">{metric.value}</div>
            </div>
          ))}
        </div>

        <div className="chart-card" style={{ marginTop: 16 }}>
          <div className="card-header" style={{ marginBottom: 12, padding: 0, border: 'none' }}>
            <div className="card-title">Projects by month</div>
          </div>
          <ProjectMonthlyChart data={chartProjects} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`${selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)} Projects`}
          action={
            <Tabs
              tabs={projectTabs}
              activeTab={selectedStatus}
              onTabChange={(id) => {
                setSelectedStatus(id)
                setPage(1)
              }}
            />
          }
        />
        <ProjectsTable
          data={filteredProjects}
          loading={loading}
          page={page}
          pageSize={pageSize}
          total={totalProjects}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          onSearch={handleSearch}
          onLocationFilter={handleLocationFilter}
          onDateFilter={handleDateFilter}
          onStatusChange={() => fetchProjects()}
          onEditProject={handleEditProject}
          showFilters={true}
          emptyMessage={loading ? 'Loading projects…' : `No ${selectedStatus} projects found.`}
        />
      </Card>

      <CreateProjectModal
        isOpen={showCreateProjectModal}
        onClose={() => {
          setShowCreateProjectModal(false)
          setEditingProject(null)
          fetchProjects() // Refresh projects list after modal closes
        }}
        project={editingProject}
      />
    </div>
  )
}