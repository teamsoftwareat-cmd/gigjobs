import { useState, useEffect } from 'react'
import FileUpload from '../../components/ui/FileUpload'
import { recruiterAPI } from '../../api/axios'
import { ImageModal } from '../../components/ui/ImageModal'
import {MapModal} from '../../components/ui/MapModal'

function FaceMatching() {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [hasData, setHasData] = useState([])
  const [selectedImage, setSelectedImage] = useState([])
  const [isModalOpen, setisModalOpen] = useState(false)
  const [MapModalOpen,setMapModalOpen] = useState(false)
  const [mapMarkers, setMapMarkers] = useState([])
  const [searchCompleted, setSearchCompleted] = useState(false)


  const handleMapModalOpen = (coordinates) => {
    const [latitude, longitude] = coordinates.split(',').map(coord => parseFloat(coord))
    setMapMarkers([{ latitude, longitude }])
    setMapModalOpen(true)
  }

  const handleMapModalClose = () => {
    setMapModalOpen(false)
    setMapMarkers([])
  }



  const handleImageClick = (imageUrl) => {
    setSelectedImage(imageUrl)
    setisModalOpen(true)
  }

  const handleCloseModal = () => {
    setisModalOpen(false)
    setSelectedImage(null)
  }

  const handleFileUpload = () => {
    setSearchCompleted(false)
    setUploading(true)
  }

  useEffect(() => {
    if (!uploading) return

    const uploadFiles = async () => {
      try {
        const formData = new FormData()

        selectedFiles.forEach((file) => {
          formData.append('files', file)
        })

        const response = await recruiterAPI.faceSearchAPI(formData)

        setHasData(response.data)
        setSearchCompleted(true)
      } catch (error) {
        console.error('Face matching error:', error)
      } finally {
        setUploading(false)
      }
    }

    uploadFiles()
  }, [selectedFiles, uploading])

  return (
    <>
  <>
    <div>
      <h3>Face Matching</h3>

      <p style={{ marginBottom: 12 }}>
        Upload candidate images to find them in projects
      </p>
    </div>

    <FileUpload
      accept="image/*"
      placeholder="Upload your photos"
      maxSize={10 * 1024 * 1024}
      onFilesChange={(files) => {
        setSelectedFiles(files)
      }}
    />

    {selectedFiles.length > 0 && (
      <button
        className="btn btn-primary"
        style={{ marginTop: 12 }}
        onClick={handleFileUpload}
        disabled={uploading}
      >
        {uploading ? 'Uploading...' : 'Upload images'}
      </button>
    )}
  </>


      {hasData.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4
            style={{
              marginBottom: 14,
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text)'
            }}
          >
            Matching Result:
          </h4>

          {/* Table wrapper for horizontal scrolling */}
          <div
            style={{
              width: '100%',
              overflowX: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 10,
              background: 'var(--bg)'
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth: 1100,
                borderCollapse: 'collapse',
                tableLayout: 'auto',
                background: 'white'
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'var(--surface)',
                    borderBottom: '2px solid var(--border)'
                  }}
                >
                  <th style={headerStyle}>
                    Match Percentage
                  </th>

                  <th style={headerStyle}>
                    Name
                  </th>

                  <th style={headerStyle}>
                    Mobile
                  </th>

                  <th style={headerStyle}>
                    Project Name
                  </th>

                  <th style={headerStyle}>
                    Designation
                  </th>

                  <th style={headerStyle}>
                    Coordinates
                  </th>

                  <th style={headerStyle}>
                    Photo
                  </th>

                  <th style={headerStyle}>
                    Location
                  </th>

                  <th style={headerStyle}>
                    District
                  </th>

                  <th style={headerStyle}>
                    Centre
                  </th>
                </tr>
              </thead>

              <tbody>
                {hasData.map((item, index) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom:
                        index !== hasData.length - 1
                          ? '1px solid var(--border)'
                          : 'none'
                    }}
                  >
                    <td style={cellStyle}>
                      {item.match_percentage ?? '-'}
                    </td>

                    <td style={cellStyle}>
                      {item.name ?? '-'}
                    </td>

                    <td style={cellStyle}>
                      {item.mobile ?? '-'}
                    </td>

                    <td style={cellStyle}>
                      {item.project_name ?? '-'}
                    </td>

                    <td style={cellStyle}>
                      {item.designation ?? '-'}
                    </td>

                    <td
                    onClick={() => item.coordinates && handleMapModalOpen(item.coordinates)}
                      style={{
                        ...cellStyle,
                        whiteSpace: 'nowrap',
                        cursor: item.coordinates ? 'pointer' : 'default',
                        color: item.coordinates ? 'var(--primary)' : 'var(--text)'
                      }}
                    >
                      {item.coordinates ?? '-'}
                    </td>

                    <td style={cellStyle}>
                      {item.photo ? (
                        <img
                          src={item.photo}
                          alt={item.name || 'Candidate'}
                          onClick={() => handleImageClick(item.photo)}
                          style={{
                            width: 52,
                            height: 52,
                            objectFit: 'cover',
                            borderRadius: 8,
                            display: 'block',
                            border: '1px solid var(--border)',
                            cursor: 'pointer'
                          }}
                        />
                      ) : (
                        '-'
                      )}
                    </td>

                    <td style={cellStyle}>
                      {item.location ?? '-'}
                    </td>

                    <td style={cellStyle}>
                      {item.district ?? '-'}
                    </td>

                    <td style={cellStyle}>
                      {item.centre ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {searchCompleted && hasData.length === 0 && (
        <div
        style={{
          padding: '30px',
          textAlign: 'center',
          border: '1px solid var(--border)',
          borderRadius: 10,
          background: 'var(--bg)',
          color: 'var(--text)'
        }}
      >
        <h4
          style={{
            marginBottom: 8,
            fontSize: 16,
            fontWeight: 700
          }}
        >
          No matching records found
        </h4>

        <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
          No candidates were found matching the uploaded image.
        </p>
      </div>
      )}

      <ImageModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        imageUrl={selectedImage}
        title="Candidate Photo"
        alt="Candidate Photo"
      />
      <MapModal
        isOpen={MapModalOpen}
        onClose={handleMapModalClose}
        markers = {mapMarkers}
      />
        </>
  )
}


/* -----------------------------
   Table Styles
----------------------------- */

const headerStyle = {
  padding: '13px 16px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text)',
  whiteSpace: 'nowrap',
  borderRight: '1px solid var(--border)'
}

const cellStyle = {
  padding: '14px 16px',
  fontSize: 13,
  color: 'var(--text)',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  borderRight: '1px solid var(--border)'
}

export default FaceMatching