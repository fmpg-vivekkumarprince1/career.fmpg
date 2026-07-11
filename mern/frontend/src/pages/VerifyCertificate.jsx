import { useEffect, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import VerifyForm from '../components/certificates/VerifyForm'

const VerifyCertificate = () => {
  const { id } = useParams()
  const location = useLocation()
  const [certificateId, setCertificateId] = useState(null)
  
  useEffect(() => {
    // Check for certificate ID in route parameter
    if (id) {
      setCertificateId(id)
    } 
    // Check for certificate ID in hash fragment (for backward compatibility)
    else if (location.hash) {
      const hashId = location.hash.substring(1) // Remove the # symbol
      if (hashId) {
        setCertificateId(hashId)
      }
    }
  }, [id, location.hash])
  
  return (
    <div className="ui-page">
      <div className="mx-auto max-w-3xl">
        <div className="ui-page-header text-center">
          <span className="fmpg-kicker">Credential verification</span>
          <h1 className="ui-page-title mt-3">Verify a certificate</h1>
          <p className="ui-page-subtitle mx-auto">Confirm that a certificate was issued by FMPG using its unique identifier.</p>
        </div>
        <VerifyForm certificateId={certificateId} />
      </div>
    </div>
  )
}

export default VerifyCertificate
