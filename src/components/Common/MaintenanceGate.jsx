import React from 'react'
import MaintenancePage from './MaintenancePage'

const MaintenanceGate = ({ enabled = false, children, ...props }) => {
  if (enabled) {
    return <MaintenancePage {...props} />
  }

  return children
}

export default MaintenanceGate
