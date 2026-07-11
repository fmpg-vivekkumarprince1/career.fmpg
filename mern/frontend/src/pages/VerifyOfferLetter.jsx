import { useEffect, useState } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import VerifyOfferLetterForm from '../components/offerletters/VerifyOfferLetterForm'

const VerifyOfferLetter = () => {
  const { id } = useParams()
  const location = useLocation()
  const [offerId, setOfferId] = useState(null)
  
  useEffect(() => {
    // Check for offer letter ID in route parameter
    if (id) {
      setOfferId(id)
    } 
    // Check for offer letter ID in hash fragment (for backward compatibility)
    else if (location.hash) {
      const hashId = location.hash.substring(1) // Remove the # symbol
      if (hashId) {
        setOfferId(hashId)
      }
    }
  }, [id, location.hash])
  
  return (
    <div className="ui-page">
      <div className="mx-auto max-w-3xl">
        <div className="ui-page-header text-center">
          <span className="fmpg-kicker">Document verification</span>
          <h1 className="ui-page-title mt-3">Verify an offer letter</h1>
          <p className="ui-page-subtitle mx-auto">Check whether an employment offer was officially issued by FMPG.</p>
        </div>
        <VerifyOfferLetterForm offerId={offerId} />
      </div>
    </div>
  )
}

export default VerifyOfferLetter
