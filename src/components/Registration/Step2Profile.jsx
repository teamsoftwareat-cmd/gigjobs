import React, { useState, useEffect, useRef } from 'react'
import { components } from 'react-select'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import MultiSelectDropdown from '../Common/MultiSelectDropdown'
import EmailVerification from './EmailVerification'
import { LoadingOverlay } from '../ui'
import { step2ProfileSchema } from '../../schemas/validations'

const isFilled = (value) => String(value || '').trim().length > 0
const isValidEmail = (value) => /.+@.+\..+/.test(String(value || '').trim())
const normalizeDigipin = (value) => String(value || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()

const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam',
  'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli',
  'Daman and Diu', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Puducherry', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
].map(state => ({ label: state, value: state }))

const AREA_OPTIONS = [
  { label: 'Mumbai', value: 'Mumbai' },
  { label: 'Delhi', value: 'Delhi' },
  { label: 'Bangalore', value: 'Bangalore' },
  { label: 'Chennai', value: 'Chennai' },
  { label: 'Kolkata', value: 'Kolkata' },
  { label: 'Hyderabad', value: 'Hyderabad' },
  { label: 'Pune', value: 'Pune' },
  { label: 'Ahmedabad', value: 'Ahmedabad' },
  { label: 'Jaipur', value: 'Jaipur' },
  { label: 'Lucknow', value: 'Lucknow' },
  { label: 'Kanpur', value: 'Kanpur' },
  { label: 'Surat', value: 'Surat' },
  { label: 'Nagpur', value: 'Nagpur' },
  { label: 'Indore', value: 'Indore' },
  { label: 'Bhopal', value: 'Bhopal' }
]

const LANGUAGE_OPTIONS = [
  { label: 'Hindi', value: 'Hindi' },
  { label: 'English', value: 'English' },
  { label: 'Tamil', value: 'Tamil' },
  { label: 'Telugu', value: 'Telugu' },
  { label: 'Kannada', value: 'Kannada' },
  { label: 'Marathi', value: 'Marathi' },
  { label: 'Gujarati', value: 'Gujarati' },
  { label: 'Bengali', value: 'Bengali' },
  { label: 'Malayalam', value: 'Malayalam' },
  { label: 'Punjabi', value: 'Punjabi' },
  { label: 'Urdu', value: 'Urdu' }
]

const GENDER_OPTIONS = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Third Gender', value: 'Third gender' }
]

const EDUCATION_LEVEL_OPTIONS = [
  { label: '10th Pass', value: '10th Pass' },
  { label: '12th Pass', value: '12th Pass' },
  { label: 'Diploma', value: 'Diploma' },
  { label: 'Graduate', value: 'Graduate' },
  { label: 'Postgraduate', value: 'Postgraduate' }
]

const BIHAR_DISTRICT_OPTIONS = [
  { label: 'Araria', value: 'Araria' },
  { label: 'Arwal', value: 'Arwal' },
  { label: 'Aurangabad', value: 'Aurangabad' },
  { label: 'Banka', value: 'Banka' },
  { label: 'Begusarai', value: 'Begusarai' },
  { label: 'Bhagalpur', value: 'Bhagalpur' },
  { label: 'Bhojpur', value: 'Bhojpur' },
  { label: 'Buxar', value: 'Buxar' },
  { label: 'Darbhanga', value: 'Darbhanga' },
  { label: 'Gaya', value: 'Gaya' },
  { label: 'Gopalganj', value: 'Gopalganj' },
  { label: 'Jamui', value: 'Jamui' },
  { label: 'Jehanabad', value: 'Jehanabad' },
  { label: 'Kaimur', value: 'Kaimur' },
  { label: 'Katihar', value: 'Katihar' },
  { label: 'Khagaria', value: 'Khagaria' },
  { label: 'Kishanganj', value: 'Kishanganj' },
  { label: 'Lakhisarai', value: 'Lakhisarai' },
  { label: 'Madhepura', value: 'Madhepura' },
  { label: 'Madhubani', value: 'Madhubani' },
  { label: 'Munger', value: 'Munger' },
  { label: 'Muzaffarpur', value: 'Muzaffarpur' },
  { label: 'Nalanda', value: 'Nalanda' },
  { label: 'Nawada', value: 'Nawada' },
  { label: 'Pashchim Champaran', value: 'Pashchim Champaran' },
  { label: 'Patna', value: 'Patna' },
  { label: 'Purnia', value: 'Purnia' },
  { label: 'Rohtas', value: 'Rohtas' },
  { label: 'Saharsa', value: 'Saharsa' },
  { label: 'Samastipur', value: 'Samastipur' },
  { label: 'Saran', value: 'Saran' },
  { label: 'Sheikhpura', value: 'Sheikhpura' },
  { label: 'Sheohar', value: 'Sheohar' },
  { label: 'Sitamarhi', value: 'Sitamarhi' },
  { label: 'Siwan', value: 'Siwan' },
  { label: 'Supaul', value: 'Supaul' },
  { label: 'Vaishali', value: 'Vaishali' },
  { label: 'East Champaran', value: 'East Champaran' },
  { label: 'West Champaran', value: 'West Champaran' },
  { label: 'Purbi Champaran', value: 'Purbi Champaran' },
  { label: 'Pashchim Champaran', value: 'Pashchim Champaran' }
]

const BIHAR_POLICE_STATIONS = [
  { district: 'araria', pincode: '854311', policeStation: 'Araria (Sadar) P.S.' },
  { district: 'araria', pincode: '854311', policeStation: 'Araria Mufassil P.S.' },
  { district: 'araria', pincode: '854318', policeStation: 'Forbesganj P.S.' },
  { district: 'araria', pincode: '854318', policeStation: 'Forbesganj Mufassil P.S.' },
  { district: 'araria', pincode: '854328', policeStation: 'Jokihat P.S.' },
  { district: 'araria', pincode: '854333', policeStation: 'Palasi P.S.' },
  { district: 'araria', pincode: '854334', policeStation: 'Kursakanta P.S.' },
  { district: 'araria', pincode: '854335', policeStation: 'Sikti P.S.' },
  { district: 'araria', pincode: '854334', policeStation: 'Raniganj P.S.' },
  { district: 'araria', pincode: '854317', policeStation: 'Bhargama P.S.' },
  { district: 'araria', pincode: '854340', policeStation: 'Narpatganj P.S.' },
  { district: 'araria', pincode: '854334', policeStation: 'Kursela/Kursakatta OP' },
  { district: 'arwal', pincode: '804401', policeStation: 'Arwal (Sadar) P.S.' },
  { district: 'arwal', pincode: '804404', policeStation: 'Kaler P.S.' },
  { district: 'arwal', pincode: '804453', policeStation: 'Kurtha P.S.' },
  { district: 'arwal', pincode: '804419', policeStation: 'Karpi P.S.' },
  { district: 'arwal', pincode: '804453', policeStation: 'Vanshi P.S.' },
  { district: 'arwal', pincode: '804419', policeStation: 'Mehndia P.S.' },
  { district: 'aurangabad', pincode: '824101', policeStation: 'Aurangabad Nagar P.S.' },
  { district: 'aurangabad', pincode: '824101', policeStation: 'Aurangabad Mufassil P.S.' },
  { district: 'aurangabad', pincode: '824125', policeStation: 'Rafiganj P.S.' },
  { district: 'aurangabad', pincode: '824124', policeStation: 'Obra P.S.' },
  { district: 'aurangabad', pincode: '824143', policeStation: 'Daudnagar P.S.' },
  { district: 'aurangabad', pincode: '824102', policeStation: 'Barun P.S.' },
  { district: 'aurangabad', pincode: '824112', policeStation: 'Kutumba P.S.' },
  { district: 'aurangabad', pincode: '824202', policeStation: 'Deo P.S.' },
  { district: 'aurangabad', pincode: '824203', policeStation: 'Madanpur P.S.' },
  { district: 'aurangabad', pincode: '824303', policeStation: 'Nabinagar P.S.' },
  { district: 'aurangabad', pincode: '824201', policeStation: 'Goh P.S.' },
  { district: 'aurangabad', pincode: '824121', policeStation: 'Haspura P.S.' },
  { district: 'banka', pincode: '813102', policeStation: 'Banka (Sadar) P.S.' },
  { district: 'banka', pincode: '813103', policeStation: 'Amarpur P.S.' },
  { district: 'banka', pincode: '813104', policeStation: 'Barahat P.S.' },
  { district: 'banka', pincode: '813107', policeStation: 'Belhar P.S.' },
  { district: 'banka', pincode: '813105', policeStation: 'Bounsi P.S.' },
  { district: 'banka', pincode: '813106', policeStation: 'Chandan P.S.' },
  { district: 'banka', pincode: '813109', policeStation: 'Dhoraiya P.S.' },
  { district: 'banka', pincode: '813107', policeStation: 'Fullidumar P.S.' },
  { district: 'banka', pincode: '813106', policeStation: 'Katoria P.S.' },
  { district: 'banka', pincode: '813108', policeStation: 'Rajaun P.S.' },
  { district: 'banka', pincode: '813104', policeStation: 'Shambhuganj P.S.' },
  { district: 'begusarai', pincode: '851101', policeStation: 'Nagar P.S., Begusarai' },
  { district: 'begusarai', pincode: '851101', policeStation: 'Mufassil P.S., Begusarai' },
  { district: 'begusarai', pincode: '851112', policeStation: 'Barauni P.S.' },
  { district: 'begusarai', pincode: '851133', policeStation: 'Teghra P.S.' },
  { district: 'begusarai', pincode: '851111', policeStation: 'Bachhwara P.S.' },
  { district: 'begusarai', pincode: '851117', policeStation: 'Ballia P.S.' },
  { district: 'begusarai', pincode: '851101', policeStation: 'Bakhri P.S.' },
  { district: 'begusarai', pincode: '851129', policeStation: 'Cheria Bariarpur P.S.' },
  { district: 'begusarai', pincode: '851213', policeStation: 'Sahebpur Kamal P.S.' },
  { district: 'begusarai', pincode: '851101', policeStation: 'Matihani P.S.' },
  { district: 'begusarai', pincode: '851129', policeStation: 'Bihat P.S.' },
  { district: 'begusarai', pincode: '851128', policeStation: 'Naokothi P.S.' },
  { district: 'begusarai', pincode: '851130', policeStation: 'Khodabandpur P.S.' },
  { district: 'begusarai', pincode: '851130', policeStation: 'Mansurchak P.S.' },
  { district: 'begusarai', pincode: '851129', policeStation: 'Birpur P.S.' },
  { district: 'begusarai', pincode: '851128', policeStation: 'Garhpura P.S.' },
  { district: 'begusarai', pincode: '851132', policeStation: 'Dandari P.S.' },
  { district: 'begusarai', pincode: '851133', policeStation: 'Chhaurahi P.S.' },
  { district: 'bhagalpur', pincode: '812001', policeStation: 'Kotwali P.S., Bhagalpur' },
  { district: 'bhagalpur', pincode: '812003', policeStation: 'Barari P.S.' },
  { district: 'bhagalpur', pincode: '812001', policeStation: 'Ishakchak P.S.' },
  { district: 'bhagalpur', pincode: '812006', policeStation: 'Nathnagar P.S.' },
  { district: 'bhagalpur', pincode: '812002', policeStation: 'Adampur P.S.' },
  { district: 'bhagalpur', pincode: '812001', policeStation: 'Mojahidpur P.S.' },
  { district: 'bhagalpur', pincode: '812002', policeStation: 'Tatarpur P.S.' },
  { district: 'bhagalpur', pincode: '812002', policeStation: 'Habibpur P.S.' },
  { district: 'bhagalpur', pincode: '813210', policeStation: 'Sabour P.S.' },
  { district: 'bhagalpur', pincode: '813203', policeStation: 'Kahalgaon P.S.' },
  { district: 'bhagalpur', pincode: '813213', policeStation: 'Sultanganj P.S.' },
  { district: 'bhagalpur', pincode: '853204', policeStation: 'Naugachhia P.S.' },
  { district: 'bhagalpur', pincode: '853202', policeStation: 'Bihpur P.S.' },
  { district: 'bhagalpur', pincode: '853205', policeStation: 'Gopalpur P.S.' },
  { district: 'bhagalpur', pincode: '853205', policeStation: 'Kharik P.S.' },
  { district: 'bhagalpur', pincode: '853203', policeStation: 'Narayanpur P.S.' },
  { district: 'bhagalpur', pincode: '853204', policeStation: 'Rangra Chowk P.S.' },
  { district: 'bhagalpur', pincode: '853204', policeStation: 'Ismailpur P.S.' },
  { district: 'bhagalpur', pincode: '813203', policeStation: 'Colgong (Kahalgaon) P.S.' },
  { district: 'bhagalpur', pincode: '813212', policeStation: 'Sanhoula P.S.' },
  { district: 'bhagalpur', pincode: '813210', policeStation: 'Jagdishpur P.S.' },
  { district: 'bhagalpur', pincode: '813211', policeStation: 'Goradih P.S.' },
  { district: 'bhagalpur', pincode: '813211', policeStation: 'Shahkund P.S.' },
  { district: 'bhagalpur', pincode: '813207', policeStation: 'Pirpainti P.S.' },
  { district: 'bhojpur', pincode: '802301', policeStation: 'Ara Nagar P.S.' },
  { district: 'bhojpur', pincode: '802301', policeStation: 'Ara Mufassil P.S.' },
  { district: 'bhojpur', pincode: '802160', policeStation: 'Koilwar P.S.' },
  { district: 'bhojpur', pincode: '802152', policeStation: 'Bihiya P.S.' },
  { district: 'bhojpur', pincode: '802207', policeStation: 'Piro P.S.' },
  { district: 'bhojpur', pincode: '802158', policeStation: 'Jagdishpur P.S.' },
  { district: 'bhojpur', pincode: '802209', policeStation: 'Sahar P.S.' },
  { district: 'bhojpur', pincode: '802162', policeStation: 'Sandesh P.S.' },
  { district: 'bhojpur', pincode: '802164', policeStation: 'Shahpur P.S.' },
  { district: 'bhojpur', pincode: '802154', policeStation: 'Barhara P.S.' },
  { district: 'bhojpur', pincode: '802208', policeStation: 'Charpokhari P.S.' },
  { district: 'bhojpur', pincode: '802207', policeStation: 'Tarari P.S.' },
  { district: 'bhojpur', pincode: '802315', policeStation: 'Agiaon P.S.' },
  { district: 'bhojpur', pincode: '802161', policeStation: 'Udwantnagar P.S.' },
  { district: 'buxar', pincode: '802101', policeStation: 'Buxar (Nagar) P.S.' },
  { district: 'buxar', pincode: '802101', policeStation: 'Buxar Mufassil P.S.' },
  { district: 'buxar', pincode: '802119', policeStation: 'Dumraon P.S.' },
  { district: 'buxar', pincode: '802125', policeStation: 'Rajpur P.S.' },
  { district: 'buxar', pincode: '802114', policeStation: 'Chausa P.S.' },
  { district: 'buxar', pincode: '802128', policeStation: 'Simri P.S.' },
  { district: 'buxar', pincode: '802101', policeStation: 'Chakki P.S.' },
  { district: 'buxar', pincode: '802126', policeStation: 'Itarhi P.S.' },
  { district: 'buxar', pincode: '802133', policeStation: 'Nawanagar P.S.' },
  { district: 'buxar', pincode: '802117', policeStation: 'Brahmpur P.S.' },
  { district: 'buxar', pincode: '802117', policeStation: 'Kesath P.S.' },
  { district: 'darbhanga', pincode: '846004', policeStation: 'Town P.S., Darbhanga' },
  { district: 'darbhanga', pincode: '846001', policeStation: 'Laheriasarai P.S.' },
  { district: 'darbhanga', pincode: '846004', policeStation: 'Sadar P.S., Darbhanga' },
  { district: 'darbhanga', pincode: '846004', policeStation: 'University P.S.' },
  { district: 'darbhanga', pincode: '847105', policeStation: 'Benipur P.S.' },
  { district: 'darbhanga', pincode: '847203', policeStation: 'Biraul P.S.' },
  { district: 'darbhanga', pincode: '847302', policeStation: 'Ghanshyampur P.S.' },
  { district: 'darbhanga', pincode: '847302', policeStation: 'Kiratpur P.S.' },
  { district: 'darbhanga', pincode: '847304', policeStation: 'Kusheshwarasthan P.S.' },
  { district: 'darbhanga', pincode: '847233', policeStation: 'Manigachhi P.S.' },
  { district: 'darbhanga', pincode: '846009', policeStation: 'Bahadurpur P.S.' },
  { district: 'darbhanga', pincode: '847105', policeStation: 'Baheri P.S.' },
  { district: 'darbhanga', pincode: '847107', policeStation: 'Bahera P.S.' },
  { district: 'darbhanga', pincode: '847304', policeStation: 'Alinagar P.S.' },
  { district: 'darbhanga', pincode: '847232', policeStation: 'Singhwara P.S.' },
  { district: 'darbhanga', pincode: '847302', policeStation: 'Jale P.S.' },
  { district: 'darbhanga', pincode: '846005', policeStation: 'Hayaghat P.S.' },
  { district: 'darbhanga', pincode: '847232', policeStation: 'Hanuman Nagar P.S.' },
  { district: 'darbhanga', pincode: '846007', policeStation: 'Keotirunway P.S.' },
  { district: 'darbhanga', pincode: '847226', policeStation: 'Sakri (Tarauni) P.S.' },
  { district: 'east champaran', pincode: '845401', policeStation: 'Motihari Town P.S.' },
  { district: 'east champaran', pincode: '845401', policeStation: 'Motihari Muffasil P.S.' },
  { district: 'east champaran', pincode: '845412', policeStation: 'Chakia P.S.' },
  { district: 'east champaran', pincode: '845418', policeStation: 'Mehsi P.S.' },
  { district: 'east champaran', pincode: '845411', policeStation: 'Areraj P.S.' },
  { district: 'east champaran', pincode: '845450', policeStation: 'Pipra P.S.' },
  { district: 'east champaran', pincode: '845456', policeStation: 'Sugauli P.S.' },
  { district: 'east champaran', pincode: '845305', policeStation: 'Raxaul P.S.' },
  { district: 'east champaran', pincode: '845307', policeStation: 'Adapur P.S.' },
  { district: 'east champaran', pincode: '845433', policeStation: 'Ramgarhwa P.S.' },
  { district: 'east champaran', pincode: '845436', policeStation: 'Ghorasahan P.S.' },
  { district: 'east champaran', pincode: '845424', policeStation: 'Dhaka P.S.' },
  { district: 'east champaran', pincode: '845428', policeStation: 'Chiraia P.S.' },
  { district: 'east champaran', pincode: '845429', policeStation: 'Madhuban P.S.' },
  { district: 'east champaran', pincode: '845424', policeStation: 'Kesaria P.S.' },
  { district: 'east champaran', pincode: '845436', policeStation: 'Harsidhi P.S.' },
  { district: 'east champaran', pincode: '845454', policeStation: 'Kalyanpur P.S.' },
  { district: 'east champaran', pincode: '845401', policeStation: 'Turkaulia P.S.' },
  { district: 'east champaran', pincode: '845418', policeStation: 'Sangrampur P.S.' },
  { district: 'east champaran', pincode: '845401', policeStation: 'Paharpur P.S.' },
  { district: 'east champaran', pincode: '845436', policeStation: 'Bankatwa P.S.' },
  { district: 'east champaran', pincode: '845412', policeStation: 'Patahi P.S.' },
  { district: 'east champaran', pincode: '845401', policeStation: 'Phenhara P.S.' },
  { district: 'gaya', pincode: '823001', policeStation: 'Kotwali P.S., Gaya' },
  { district: 'gaya', pincode: '823001', policeStation: 'Civil Lines P.S., Gaya' },
  { district: 'gaya', pincode: '823001', policeStation: 'Rampur P.S.' },
  { district: 'gaya', pincode: '823002', policeStation: 'Chandauti P.S.' },
  { district: 'gaya', pincode: '823003', policeStation: 'Buniyadganj P.S.' },
  { district: 'gaya', pincode: '823005', policeStation: 'Magadh Medical P.S.' },
  { district: 'gaya', pincode: '805130', policeStation: 'Belaganj P.S.' },
  { district: 'gaya', pincode: '805130', policeStation: 'Khizarsarai P.S.' },
  { district: 'gaya', pincode: '805131', policeStation: 'Wazirganj P.S.' },
  { district: 'gaya', pincode: '823004', policeStation: 'Konch P.S.' },
  { district: 'gaya', pincode: '824236', policeStation: 'Tekari P.S.' },
  { district: 'gaya', pincode: '824207', policeStation: 'Guraru P.S.' },
  { district: 'gaya', pincode: '824204', policeStation: 'Amas P.S.' },
  { district: 'gaya', pincode: '824211', policeStation: 'Sherghati P.S.' },
  { district: 'gaya', pincode: '824235', policeStation: 'Dobhi P.S.' },
  { district: 'gaya', pincode: '824231', policeStation: 'Bodh Gaya P.S.' },
  { district: 'gaya', pincode: '824234', policeStation: 'Fatehpur P.S.' },
  { district: 'gaya', pincode: '824234', policeStation: 'Barachatti P.S.' },
  { district: 'gaya', pincode: '805125', policeStation: 'Mohanpur P.S.' },
  { district: 'gaya', pincode: '805130', policeStation: 'Neemchak Bathani P.S.' },
  { district: 'gaya', pincode: '805103', policeStation: 'Atri P.S.' },
  { district: 'gaya', pincode: '805127', policeStation: 'Paraiya P.S.' },
  { district: 'gaya', pincode: '805130', policeStation: 'Bathani P.S.' },
  { district: 'gaya', pincode: '824216', policeStation: 'Imamganj P.S.' },
  { district: 'gaya', pincode: '824220', policeStation: 'Banke Bazar P.S.' },
  { district: 'gaya', pincode: '824221', policeStation: 'Dumaria P.S.' },
  { district: 'gaya', pincode: '824205', policeStation: 'Gurua P.S.' },
  { district: 'gaya', pincode: '823003', policeStation: 'Manpur P.S.' },
  { district: 'gopalganj', pincode: '841428', policeStation: 'Gopalganj Nagar P.S.' },
  { district: 'gopalganj', pincode: '841428', policeStation: 'Gopalganj Mufassil P.S.' },
  { district: 'gopalganj', pincode: '841504', policeStation: 'Kateya P.S.' },
  { district: 'gopalganj', pincode: '841427', policeStation: 'Bhorey P.S.' },
  { district: 'gopalganj', pincode: '841438', policeStation: 'Vijayipur P.S.' },
  { district: 'gopalganj', pincode: '841501', policeStation: 'Manjha P.S.' },
  { district: 'gopalganj', pincode: '841501', policeStation: 'Uchkagaon P.S.' },
  { district: 'gopalganj', pincode: '841411', policeStation: 'Barauli P.S.' },
  { district: 'gopalganj', pincode: '841504', policeStation: 'Baikunthpur P.S.' },
  { district: 'gopalganj', pincode: '841436', policeStation: 'Sidhwalia P.S.' },
  { district: 'gopalganj', pincode: '841504', policeStation: 'Kuchaikote P.S.' },
  { district: 'gopalganj', pincode: '841441', policeStation: 'Thawe P.S.' },
  { district: 'gopalganj', pincode: '841437', policeStation: 'Panchdeori P.S.' },
  { district: 'gopalganj', pincode: '841436', policeStation: 'Hathua P.S.' },
  { district: 'gopalganj', pincode: '841427', policeStation: 'Phulwaria P.S.' },
  { district: 'gopalganj', pincode: '841436', policeStation: 'Nagar Thana Hathua' },
  { district: 'jamui', pincode: '811307', policeStation: 'Jamui (Sadar) P.S.' },
  { district: 'jamui', pincode: '811307', policeStation: 'Jamui Muffasil P.S.' },
  { district: 'jamui', pincode: '811305', policeStation: 'Sikandra P.S.' },
  { district: 'jamui', pincode: '811310', policeStation: 'Khaira P.S.' },
  { district: 'jamui', pincode: '811310', policeStation: 'Barhat P.S.' },
  { district: 'jamui', pincode: '811308', policeStation: 'Sono P.S.' },
  { district: 'jamui', pincode: '811303', policeStation: 'Chakai P.S.' },
  { district: 'jamui', pincode: '811308', policeStation: 'Jhajha P.S.' },
  { district: 'jamui', pincode: '811305', policeStation: 'Gidhaur P.S.' },
  { district: 'jamui', pincode: '811302', policeStation: 'Aliganj P.S.' },
  { district: 'jamui', pincode: '811311', policeStation: 'Laxmipur P.S.' },
  { district: 'jamui', pincode: '811307', policeStation: 'Islamnagar P.S.' },
  { district: 'jamui', pincode: '811310', policeStation: 'Bakhorapur P.S.' },
  { district: 'jehanabad', pincode: '804408', policeStation: 'Jehanabad (Sadar) P.S.' },
  { district: 'jehanabad', pincode: '804408', policeStation: 'Jehanabad Mufassil P.S.' },
  { district: 'jehanabad', pincode: '804404', policeStation: 'Ghosi P.S.' },
  { district: 'jehanabad', pincode: '804417', policeStation: 'Hulasganj P.S.' },
  { district: 'jehanabad', pincode: '804406', policeStation: 'Makhdumpur P.S.' },
  { district: 'jehanabad', pincode: '804453', policeStation: 'Ratni Faridpur P.S.' },
  { district: 'jehanabad', pincode: '804408', policeStation: 'Kako P.S.' },
  { district: 'jehanabad', pincode: '804453', policeStation: 'Modanganj P.S.' },
  { district: 'kaimur', pincode: '821101', policeStation: 'Bhabua (Sadar) P.S.' },
  { district: 'kaimur', pincode: '821101', policeStation: 'Bhabua Mufassil P.S.' },
  { district: 'kaimur', pincode: '821109', policeStation: 'Mohania P.S.' },
  { district: 'kaimur', pincode: '821110', policeStation: 'Ramgarh P.S.' },
  { district: 'kaimur', pincode: '821103', policeStation: 'Chainpur P.S.' },
  { district: 'kaimur', pincode: '821102', policeStation: 'Adhaura P.S.' },
  { district: 'kaimur', pincode: '821105', policeStation: 'Chand P.S.' },
  { district: 'kaimur', pincode: '821106', policeStation: 'Bhagwanpur P.S.' },
  { district: 'kaimur', pincode: '821104', policeStation: 'Kudra P.S.' },
  { district: 'kaimur', pincode: '821101', policeStation: 'Nuaon P.S.' },
  { district: 'kaimur', pincode: '821110', policeStation: 'Rampur P.S.' },
  { district: 'kaimur', pincode: '821105', policeStation: 'Durgawati P.S.' },
  { district: 'kaimur', pincode: '821102', policeStation: 'Sonhan P.S.' },
  { district: 'katihar', pincode: '854105', policeStation: 'Katihar Nagar P.S.' },
  { district: 'katihar', pincode: '854105', policeStation: 'Katihar Muffasil P.S.' },
  { district: 'katihar', pincode: '854113', policeStation: 'Manihari P.S.' },
  { district: 'katihar', pincode: '854114', policeStation: 'Amdabad P.S.' },
  { district: 'katihar', pincode: '854108', policeStation: 'Barari P.S.' },
  { district: 'katihar', pincode: '855102', policeStation: 'Barsoi P.S.' },
  { district: 'katihar', pincode: '855101', policeStation: 'Azamnagar P.S.' },
  { district: 'katihar', pincode: '854107', policeStation: 'Balrampur P.S.' },
  { district: 'katihar', pincode: '854106', policeStation: 'Kadwa P.S.' },
  { district: 'katihar', pincode: '854109', policeStation: 'Korha P.S.' },
  { district: 'katihar', pincode: '854107', policeStation: 'Kursela P.S.' },
  { district: 'katihar', pincode: '854103', policeStation: 'Falka P.S.' },
  { district: 'katihar', pincode: '855107', policeStation: 'Pranpur P.S.' },
  { district: 'katihar', pincode: '854107', policeStation: 'Sameli P.S.' },
  { district: 'katihar', pincode: '855101', policeStation: 'Hasanganj P.S.' },
  { district: 'katihar', pincode: '854107', policeStation: 'Mansahi P.S.' },
  { district: 'katihar', pincode: '854103', policeStation: 'Dandkhora P.S.' },
  { district: 'khagaria', pincode: '851204', policeStation: 'Khagaria (Sadar) P.S.' },
  { district: 'khagaria', pincode: '851204', policeStation: 'Khagaria Muffasil P.S.' },
  { district: 'khagaria', pincode: '851210', policeStation: 'Alauli P.S.' },
  { district: 'khagaria', pincode: '851213', policeStation: 'Beldaur P.S.' },
  { district: 'khagaria', pincode: '851205', policeStation: 'Chautham P.S.' },
  { district: 'khagaria', pincode: '851213', policeStation: 'Gogri P.S.' },
  { district: 'khagaria', pincode: '851213', policeStation: 'Parbatta P.S.' },
  { district: 'khagaria', pincode: '851213', policeStation: 'Mansi P.S.' },
  { district: 'khagaria', pincode: '851210', policeStation: 'Bakhtiyarpur (Khagaria) P.S.' },
  { district: 'kishanganj', pincode: '855107', policeStation: 'Kishanganj Nagar P.S.' },
  { district: 'kishanganj', pincode: '855107', policeStation: 'Kishanganj Muffasil P.S.' },
  { district: 'kishanganj', pincode: '855105', policeStation: 'Bahadurganj P.S.' },
  { district: 'kishanganj', pincode: '855116', policeStation: 'Thakurganj P.S.' },
  { district: 'kishanganj', pincode: '855107', policeStation: 'Dighalbank P.S.' },
  { district: 'kishanganj', pincode: '855108', policeStation: 'Terhagachh P.S.' },
  { district: 'kishanganj', pincode: '855108', policeStation: 'Kochadhaman P.S.' },
  { district: 'kishanganj', pincode: '855115', policeStation: 'Pothia P.S.' },
  { district: 'kishanganj', pincode: '855117', policeStation: 'Galgalia P.S.' },
  { district: 'lakhisarai', pincode: '811311', policeStation: 'Lakhisarai (Sadar) P.S.' },
  { district: 'lakhisarai', pincode: '811311', policeStation: 'Lakhisarai Muffasil P.S.' },
  { district: 'lakhisarai', pincode: '811302', policeStation: 'Barahiya P.S.' },
  { district: 'lakhisarai', pincode: '811310', policeStation: 'Chanan P.S.' },
  { district: 'lakhisarai', pincode: '811106', policeStation: 'Halsi P.S.' },
  { district: 'lakhisarai', pincode: '811106', policeStation: 'Piparia P.S.' },
  { district: 'lakhisarai', pincode: '811311', policeStation: 'Ramgarh Chowk P.S.' },
  { district: 'lakhisarai', pincode: '811106', policeStation: 'Surajgarha P.S.' },
  { district: 'lakhisarai', pincode: '811311', policeStation: 'Kajra P.S.' },
  { district: 'madhepura', pincode: '852113', policeStation: 'Madhepura (Sadar) P.S.' },
  { district: 'madhepura', pincode: '852113', policeStation: 'Madhepura Muffasil P.S.' },
  { district: 'madhepura', pincode: '852125', policeStation: 'Alamnagar P.S.' },
  { district: 'madhepura', pincode: '852111', policeStation: 'Bihariganj P.S.' },
  { district: 'madhepura', pincode: '852121', policeStation: 'Chausa P.S.' },
  { district: 'madhepura', pincode: '852123', policeStation: 'Gwalpara P.S.' },
  { district: 'madhepura', pincode: '852220', policeStation: 'Kumarkhand P.S.' },
  { district: 'madhepura', pincode: '852122', policeStation: 'Murliganj P.S.' },
  { district: 'madhepura', pincode: '852121', policeStation: 'Puraini P.S.' },
  { district: 'madhepura', pincode: '852123', policeStation: 'Shankarpur P.S.' },
  { district: 'madhepura', pincode: '852128', policeStation: 'Singheshwar P.S.' },
  { district: 'madhepura', pincode: '852113', policeStation: 'Ghailarh P.S.' },
  { district: 'madhepura', pincode: '852220', policeStation: 'Uda-Kishunganj P.S.' },
  { district: 'madhubani', pincode: '847211', policeStation: 'Madhubani Nagar P.S.' },
  { district: 'madhubani', pincode: '847211', policeStation: 'Madhubani Muffasil P.S.' },
  { district: 'madhubani', pincode: '847235', policeStation: 'Rajnagar P.S.' },
  { district: 'madhubani', pincode: '847402', policeStation: 'Andharatharhi P.S.' },
  { district: 'madhubani', pincode: '847107', policeStation: 'Babubarhi P.S.' },
  { district: 'madhubani', pincode: '847223', policeStation: 'Basopatti P.S.' },
  { district: 'madhubani', pincode: '847223', policeStation: 'Benipatti P.S.' },
  { district: 'madhubani', pincode: '847225', policeStation: 'Bisfi P.S.' },
  { district: 'madhubani', pincode: '847402', policeStation: 'Ghoghardiha P.S.' },
  { district: 'madhubani', pincode: '847232', policeStation: 'Harlakhi P.S.' },
  { district: 'madhubani', pincode: '847226', policeStation: 'Jaynagar P.S.' },
  { district: 'madhubani', pincode: '847404', policeStation: 'Jhanjharpur P.S.' },
  { district: 'madhubani', pincode: '847410', policeStation: 'Kaluahi P.S.' },
  { district: 'madhubani', pincode: '847229', policeStation: 'Khajauli P.S.' },
  { district: 'madhubani', pincode: '847402', policeStation: 'Khutauna P.S.' },
  { district: 'madhubani', pincode: '847222', policeStation: 'Ladania P.S.' },
  { district: 'madhubani', pincode: '847228', policeStation: 'Lakhnaur P.S.' },
  { district: 'madhubani', pincode: '847451', policeStation: 'Laukaha P.S.' },
  { district: 'madhubani', pincode: '847451', policeStation: 'Laukahi P.S.' },
  { district: 'madhubani', pincode: '847408', policeStation: 'Madhepur P.S.' },
  { district: 'madhubani', pincode: '847410', policeStation: 'Madhwapur P.S.' },
  { district: 'madhubani', pincode: '847234', policeStation: 'Pandaul P.S.' },
  { district: 'madhubani', pincode: '847452', policeStation: 'Phulparas P.S.' },
  { district: 'munger', pincode: '811201', policeStation: 'Kotwali P.S., Munger' },
  { district: 'munger', pincode: '811201', policeStation: 'Mufassil P.S., Munger' },
  { district: 'munger', pincode: '811214', policeStation: 'Jamalpur P.S.' },
  { district: 'munger', pincode: '811211', policeStation: 'Bariarpur P.S.' },
  { district: 'munger', pincode: '811213', policeStation: 'Dharhara P.S.' },
  { district: 'munger', pincode: '811213', policeStation: 'Haveli Kharagpur P.S.' },
  { district: 'munger', pincode: '811202', policeStation: 'Sangrampur P.S.' },
  { district: 'munger', pincode: '813221', policeStation: 'Tarapur P.S.' },
  { district: 'munger', pincode: '813221', policeStation: 'Asarganj P.S.' },
  { district: 'munger', pincode: '811202', policeStation: 'Tetiabambar P.S.' },
  { district: 'muzaffarpur', pincode: '842001', policeStation: 'Town P.S., Muzaffarpur' },
  { district: 'muzaffarpur', pincode: '842001', policeStation: 'Nagar P.S., Muzaffarpur' },
  { district: 'muzaffarpur', pincode: '842001', policeStation: 'Kazi Mohammadpur P.S.' },
  { district: 'muzaffarpur', pincode: '842003', policeStation: 'Brahmpura P.S.' },
  { district: 'muzaffarpur', pincode: '842001', policeStation: 'Sadar P.S.' },
  { district: 'muzaffarpur', pincode: '842001', policeStation: 'University P.S.' },
  { district: 'muzaffarpur', pincode: '842001', policeStation: 'Ahiapur P.S.' },
  { district: 'muzaffarpur', pincode: '842002', policeStation: 'Mithanpura P.S.' },
  { district: 'muzaffarpur', pincode: '843118', policeStation: 'Bochaha P.S.' },
  { district: 'muzaffarpur', pincode: '843109', policeStation: 'Kanti P.S.' },
  { district: 'muzaffarpur', pincode: '843142', policeStation: 'Sakra P.S.' },
  { district: 'muzaffarpur', pincode: '843103', policeStation: 'Aurai P.S.' },
  { district: 'muzaffarpur', pincode: '843133', policeStation: 'Katra P.S.' },
  { district: 'muzaffarpur', pincode: '843107', policeStation: 'Gaighat P.S.' },
  { district: 'muzaffarpur', pincode: '842001', policeStation: 'Musahari P.S.' },
  { district: 'muzaffarpur', pincode: '843125', policeStation: 'Marwan P.S.' },
  { district: 'muzaffarpur', pincode: '843111', policeStation: 'Motipur P.S.' },
  { district: 'muzaffarpur', pincode: '843112', policeStation: 'Paroo P.S.' },
  { district: 'muzaffarpur', pincode: '843125', policeStation: 'Sahebganj P.S.' },
  { district: 'muzaffarpur', pincode: '843126', policeStation: 'Saraiya P.S.' },
  { district: 'muzaffarpur', pincode: '843120', policeStation: 'Kurhani P.S.' },
  { district: 'muzaffarpur', pincode: '843117', policeStation: 'Minapur P.S.' },
  { district: 'muzaffarpur', pincode: '843108', policeStation: 'Bandra P.S.' },
  { district: 'muzaffarpur', pincode: '843112', policeStation: 'Baruraj P.S.' },
  { district: 'nalanda', pincode: '803101', policeStation: 'Laheri P.S., Bihar Sharif' },
  { district: 'nalanda', pincode: '803101', policeStation: 'Nagar P.S., Bihar Sharif' },
  { district: 'nalanda', pincode: '803118', policeStation: 'Sohsarai P.S.' },
  { district: 'nalanda', pincode: '803101', policeStation: 'Deep Nagar P.S.' },
  { district: 'nalanda', pincode: '803110', policeStation: 'Ben P.S.' },
  { district: 'nalanda', pincode: '803101', policeStation: 'Bind P.S.' },
  { district: 'nalanda', pincode: '803108', policeStation: 'Chandi P.S.' },
  { district: 'nalanda', pincode: '801301', policeStation: 'Ekangar Sarai P.S.' },
  { district: 'nalanda', pincode: '803116', policeStation: 'Giriak P.S.' },
  { district: 'nalanda', pincode: '803110', policeStation: 'Harnaut P.S.' },
  { district: 'nalanda', pincode: '801302', policeStation: 'Hilsa P.S.' },
  { district: 'nalanda', pincode: '801303', policeStation: 'Islampur P.S.' },
  { district: 'nalanda', pincode: '801305', policeStation: 'Karai Parsurai P.S.' },
  { district: 'nalanda', pincode: '803107', policeStation: 'Katrisarai P.S.' },
  { district: 'nalanda', pincode: '801304', policeStation: 'Nagar Nausa P.S.' },
  { district: 'nalanda', pincode: '803113', policeStation: 'Nursarai P.S.' },
  { district: 'nalanda', pincode: '803110', policeStation: 'Parwalpur P.S.' },
  { district: 'nalanda', pincode: '803111', policeStation: 'Rahui P.S.' },
  { district: 'nalanda', pincode: '803116', policeStation: 'Rajgir P.S.' },
  { district: 'nalanda', pincode: '803119', policeStation: 'Sarmera P.S.' },
  { district: 'nalanda', pincode: '803115', policeStation: 'Silao P.S.' },
  { district: 'nalanda', pincode: '803108', policeStation: 'Tharthari P.S.' },
  { district: 'nalanda', pincode: '803107', policeStation: 'Asthawan P.S.' },
  { district: 'nalanda', pincode: '803113', policeStation: 'Chhabilapur P.S.' },
  { district: 'nalanda', pincode: '803115', policeStation: 'Pawapuri P.S.' },
  { district: 'nawada', pincode: '805110', policeStation: 'Nawada Nagar P.S.' },
  { district: 'nawada', pincode: '805110', policeStation: 'Nawada Muffasil P.S.' },
  { district: 'nawada', pincode: '805130', policeStation: 'Warisaliganj P.S.' },
  { district: 'nawada', pincode: '805123', policeStation: 'Pakribarawan P.S.' },
  { district: 'nawada', pincode: '805122', policeStation: 'Kawakol P.S.' },
  { district: 'nawada', pincode: '805110', policeStation: 'Roh P.S.' },
  { district: 'nawada', pincode: '805110', policeStation: 'Nardiganj P.S.' },
  { district: 'nawada', pincode: '805103', policeStation: 'Hisua P.S.' },
  { district: 'nawada', pincode: '805121', policeStation: 'Narhat P.S.' },
  { district: 'nawada', pincode: '805125', policeStation: 'Meskaur P.S.' },
  { district: 'nawada', pincode: '805125', policeStation: 'Rajauli P.S.' },
  { district: 'nawada', pincode: '805126', policeStation: 'Sirdala P.S.' },
  { district: 'nawada', pincode: '805110', policeStation: 'Kashi Chak P.S.' },
  { district: 'nawada', pincode: '805102', policeStation: 'Akbarpur P.S.' },
  { district: 'nawada', pincode: '805110', policeStation: 'Govindpur P.S.' },
  { district: 'patna', pincode: '800001', policeStation: 'Kotwali P.S. (GPO)' },
  { district: 'patna', pincode: '800004', policeStation: 'Pirbahore P.S.' },
  { district: 'patna', pincode: '800006', policeStation: 'Sultanganj P.S.' },
  { district: 'patna', pincode: '800007', policeStation: 'Alamganj P.S.' },
  { district: 'patna', pincode: '800008', policeStation: 'Chowk P.S.' },
  { district: 'patna', pincode: '800008', policeStation: 'Khajekalan P.S.' },
  { district: 'patna', pincode: '800008', policeStation: 'Malsalami P.S.' },
  { district: 'patna', pincode: '800006', policeStation: 'Mehandiganj P.S.' },
  { district: 'patna', pincode: '800001', policeStation: 'Gandhi Maidan P.S.' },
  { district: 'patna', pincode: '800002', policeStation: 'Gardanibagh P.S.' },
  { district: 'patna', pincode: '800003', policeStation: 'Kadam Kuan P.S.' },
  { district: 'patna', pincode: '800001', policeStation: 'Buddha Colony P.S.' },
  { district: 'patna', pincode: '800020', policeStation: 'Kankarbagh P.S.' },
  { district: 'patna', pincode: '800027', policeStation: 'Ramkrishna Nagar P.S.' },
  { district: 'patna', pincode: '800026', policeStation: 'Bahadurpur P.S.' },
  { district: 'patna', pincode: '800007', policeStation: 'Agamkuan P.S.' },
  { district: 'patna', pincode: '800006', policeStation: 'Sultanganj (S) P.S.' },
  { district: 'patna', pincode: '800001', policeStation: 'Patrakar Nagar P.S.' },
  { district: 'patna', pincode: '800001', policeStation: 'SK Puri P.S.' },
  { district: 'patna', pincode: '800023', policeStation: 'Shastri Nagar P.S.' },
  { district: 'patna', pincode: '800024', policeStation: 'Rajiv Nagar P.S.' },
  { district: 'patna', pincode: '800014', policeStation: 'Rupaspur P.S.' },
  { district: 'patna', pincode: '801103', policeStation: 'Shahpur P.S.' },
  { district: 'patna', pincode: '800011', policeStation: 'Digha P.S.' },
  { district: 'patna', pincode: '800013', policeStation: 'Patliputra P.S.' },
  { district: 'patna', pincode: '801503', policeStation: 'Danapur (Cantt) P.S.' },
  { district: 'patna', pincode: '801503', policeStation: 'Danapur Nagar P.S.' },
  { district: 'patna', pincode: '801105', policeStation: 'Khagaul P.S.' },
  { district: 'patna', pincode: '801505', policeStation: 'Phulwari Sharif P.S.' },
  { district: 'patna', pincode: '800002', policeStation: 'Anisabad P.S.' },
  { district: 'patna', pincode: '800002', policeStation: 'Beur P.S.' },
  { district: 'patna', pincode: '800001', policeStation: 'Jakkanpur P.S.' },
  { district: 'patna', pincode: '800014', policeStation: 'Airport P.S.' },
  { district: 'patna', pincode: '801507', policeStation: 'AIIMS P.S.' },
  { district: 'patna', pincode: '801103', policeStation: 'Bihta P.S.' },
  { district: 'patna', pincode: '801108', policeStation: 'Maner P.S.' },
  { district: 'patna', pincode: '801109', policeStation: 'Naubatpur P.S.' },
  { district: 'patna', pincode: '801110', policeStation: 'Paliganj P.S.' },
  { district: 'patna', pincode: '801104', policeStation: 'Dulhin Bazar P.S.' },
  { district: 'patna', pincode: '801104', policeStation: 'Bikram P.S.' },
  { district: 'patna', pincode: '804452', policeStation: 'Masaurhi P.S.' },
  { district: 'patna', pincode: '804453', policeStation: 'Dhanarua P.S.' },
  { district: 'patna', pincode: '804453', policeStation: 'Punpun P.S.' },
  { district: 'patna', pincode: '803201', policeStation: 'Fatuha P.S.' },
  { district: 'patna', pincode: '803213', policeStation: 'Daniyawan P.S.' },
  { district: 'patna', pincode: '803202', policeStation: 'Khusrupur P.S.' },
  { district: 'patna', pincode: '803212', policeStation: 'Bakhtiyarpur P.S.' },
  { district: 'patna', pincode: '803203', policeStation: 'Athmalgola P.S.' },
  { district: 'patna', pincode: '803213', policeStation: 'Barh P.S.' },
  { district: 'patna', pincode: '803213', policeStation: 'Belchi P.S.' },
  { district: 'patna', pincode: '803214', policeStation: 'Pandarak P.S.' },
  { district: 'patna', pincode: '803302', policeStation: 'Mokama P.S.' },
  { district: 'patna', pincode: '803302', policeStation: 'Ghoswari P.S.' },
  { district: 'purnia', pincode: '854301', policeStation: 'K. Hat P.S., Purnia' },
  { district: 'purnia', pincode: '854301', policeStation: 'Sadar P.S., Purnia' },
  { district: 'purnia', pincode: '854301', policeStation: 'Mufassil P.S., Purnia' },
  { district: 'purnia', pincode: '854330', policeStation: 'Kasba P.S.' },
  { district: 'purnia', pincode: '854326', policeStation: 'Baisi P.S.' },
  { district: 'purnia', pincode: '854331', policeStation: 'Amour P.S.' },
  { district: 'purnia', pincode: '854328', policeStation: 'Baisa P.S.' },
  { district: 'purnia', pincode: '854202', policeStation: 'Banmankhi P.S.' },
  { district: 'purnia', pincode: '854329', policeStation: 'Barhara Kothi P.S.' },
  { district: 'purnia', pincode: '854204', policeStation: 'Bhawanipur P.S.' },
  { district: 'purnia', pincode: '854204', policeStation: 'Bhawnipur (Rajdham) P.S.' },
  { district: 'purnia', pincode: '854329', policeStation: 'B. Kothi P.S.' },
  { district: 'purnia', pincode: '854205', policeStation: 'Dhamdaha P.S.' },
  { district: 'purnia', pincode: '854301', policeStation: 'Dagarua P.S.' },
  { district: 'purnia', pincode: '854333', policeStation: 'Jalalgarh P.S.' },
  { district: 'purnia', pincode: '854301', policeStation: 'Krityanand Nagar P.S.' },
  { district: 'purnia', pincode: '854337', policeStation: 'Rupauli P.S.' },
  { district: 'purnia', pincode: '854301', policeStation: 'Srinagar P.S.' },
  { district: 'purnia', pincode: '854301', policeStation: 'Purnea East P.S.' },
  { district: 'purnia', pincode: '854301', policeStation: 'Purnea West P.S.' },
  { district: 'rohtas', pincode: '821115', policeStation: 'Sasaram Nagar P.S.' },
  { district: 'rohtas', pincode: '821115', policeStation: 'Sasaram Muffasil P.S.' },
  { district: 'rohtas', pincode: '821307', policeStation: 'Dehri P.S.' },
  { district: 'rohtas', pincode: '821305', policeStation: 'Dalmianagar P.S.' },
  { district: 'rohtas', pincode: '821309', policeStation: 'Nokha P.S.' },
  { district: 'rohtas', pincode: '802212', policeStation: 'Bikramganj P.S.' },
  { district: 'rohtas', pincode: '821310', policeStation: 'Dinara P.S.' },
  { district: 'rohtas', pincode: '802213', policeStation: 'Nasriganj P.S.' },
  { district: 'rohtas', pincode: '802215', policeStation: 'Dawath P.S.' },
  { district: 'rohtas', pincode: '821112', policeStation: 'Kargahar P.S.' },
  { district: 'rohtas', pincode: '802212', policeStation: 'Karakat P.S.' },
  { district: 'rohtas', pincode: '821113', policeStation: 'Kochas P.S.' },
  { district: 'rohtas', pincode: '821110', policeStation: 'Rajpur P.S.' },
  { district: 'rohtas', pincode: '821110', policeStation: 'Sanjhauli P.S.' },
  { district: 'rohtas', pincode: '821110', policeStation: 'Chenari P.S.' },
  { district: 'rohtas', pincode: '821115', policeStation: 'Sheosagar P.S.' },
  { district: 'rohtas', pincode: '802212', policeStation: 'Suryapura P.S.' },
  { district: 'rohtas', pincode: '821306', policeStation: 'Tilouthu P.S.' },
  { district: 'rohtas', pincode: '821311', policeStation: 'Rohtas P.S.' },
  { district: 'rohtas', pincode: '821311', policeStation: 'Nauhatta P.S.' },
  { district: 'rohtas', pincode: '821312', policeStation: 'Akorhi Gola P.S.' },
  { district: 'rohtas', pincode: '821110', policeStation: 'Chutia P.S.' },
  { district: 'saharsa', pincode: '852201', policeStation: 'Saharsa (Sadar) P.S.' },
  { district: 'saharsa', pincode: '852201', policeStation: 'Saharsa Muffasil P.S.' },
  { district: 'saharsa', pincode: '852127', policeStation: 'Simri Bakhtiyarpur P.S.' },
  { district: 'saharsa', pincode: '852216', policeStation: 'Mahishi P.S.' },
  { district: 'saharsa', pincode: '852216', policeStation: 'Nauhatta P.S.' },
  { district: 'saharsa', pincode: '852214', policeStation: 'Salkhua P.S.' },
  { district: 'saharsa', pincode: '852219', policeStation: 'Sattar Kataiya P.S.' },
  { district: 'saharsa', pincode: '852218', policeStation: 'Sonbarsa P.S.' },
  { district: 'saharsa', pincode: '852201', policeStation: 'Kahra P.S.' },
  { district: 'saharsa', pincode: '852216', policeStation: 'Banma Itahri P.S.' },
  { district: 'saharsa', pincode: '852218', policeStation: 'Patarghat P.S.' },
  { district: 'samastipur', pincode: '848101', policeStation: 'Samastipur Nagar P.S.' },
  { district: 'samastipur', pincode: '848101', policeStation: 'Samastipur Muffasil P.S.' },
  { district: 'samastipur', pincode: '848114', policeStation: 'Dalsinghsarai P.S.' },
  { district: 'samastipur', pincode: '848210', policeStation: 'Rosera P.S.' },
  { district: 'samastipur', pincode: '848504', policeStation: 'Patori P.S.' },
  { district: 'samastipur', pincode: '848130', policeStation: 'Tajpur P.S.' },
  { district: 'samastipur', pincode: '848236', policeStation: 'Warisnagar P.S.' },
  { district: 'samastipur', pincode: '848132', policeStation: 'Ujiarpur P.S.' },
  { district: 'samastipur', pincode: '848503', policeStation: 'Vidyapatinagar P.S.' },
  { district: 'samastipur', pincode: '848205', policeStation: 'Bibhutipur P.S.' },
  { district: 'samastipur', pincode: '848107', policeStation: 'Kalyanpur P.S.' },
  { district: 'samastipur', pincode: '848503', policeStation: 'Khanpur P.S.' },
  { district: 'samastipur', pincode: '848114', policeStation: 'Mohanpur P.S.' },
  { district: 'samastipur', pincode: '848501', policeStation: 'Mohiuddinnagar P.S.' },
  { district: 'samastipur', pincode: '848101', policeStation: 'Morwa P.S.' },
  { district: 'samastipur', pincode: '848127', policeStation: 'Sarairanjan P.S.' },
  { district: 'samastipur', pincode: '848504', policeStation: 'Shahpur Patori P.S.' },
  { district: 'samastipur', pincode: '848210', policeStation: 'Singhia P.S.' },
  { district: 'samastipur', pincode: '848205', policeStation: 'Hasanpur P.S.' },
  { district: 'samastipur', pincode: '848210', policeStation: 'Bithan P.S.' },
  { district: 'samastipur', pincode: '848125', policeStation: 'Pusa P.S.' },
  { district: 'saran', pincode: '841301', policeStation: 'Chhapra Town P.S.' },
  { district: 'saran', pincode: '841301', policeStation: 'Chhapra Muffasil P.S.' },
  { district: 'saran', pincode: '841301', policeStation: 'Bhagwan Bazar P.S.' },
  { district: 'saran', pincode: '841244', policeStation: 'Nagra P.S.' },
  { district: 'saran', pincode: '841411', policeStation: 'Amnour P.S.' },
  { district: 'saran', pincode: '841205', policeStation: 'Baniapur P.S.' },
  { district: 'saran', pincode: '841219', policeStation: 'Dariapur P.S.' },
  { district: 'saran', pincode: '841207', policeStation: 'Dighwara P.S.' },
  { district: 'saran', pincode: '841204', policeStation: 'Ekma P.S.' },
  { district: 'saran', pincode: '841311', policeStation: 'Garkha P.S.' },
  { district: 'saran', pincode: '841241', policeStation: 'Isuapur P.S.' },
  { district: 'saran', pincode: '841204', policeStation: 'Jalalpur P.S.' },
  { district: 'saran', pincode: '841314', policeStation: 'Lahladpur P.S.' },
  { district: 'saran', pincode: '841313', policeStation: 'Maker P.S.' },
  { district: 'saran', pincode: '841313', policeStation: 'Manjhi P.S.' },
  { district: 'saran', pincode: '841418', policeStation: 'Marhaura P.S.' },
  { district: 'saran', pincode: '841418', policeStation: 'Mashrakh P.S.' },
  { district: 'saran', pincode: '841301', policeStation: 'Mukhtiarpur P.S.' },
  { district: 'saran', pincode: '841311', policeStation: 'Panapur P.S.' },
  { district: 'saran', pincode: '841219', policeStation: 'Parsa P.S.' },
  { district: 'saran', pincode: '841301', policeStation: 'Rivilganj P.S.' },
  { district: 'saran', pincode: '841101', policeStation: 'Sonepur P.S.' },
  { district: 'saran', pincode: '841222', policeStation: 'Taraiya P.S.' },
  { district: 'saran', pincode: '841301', policeStation: 'Ismailpur P.S.' },
  { district: 'sheikhpura', pincode: '811105', policeStation: 'Sheikhpura (Sadar) P.S.' },
  { district: 'sheikhpura', pincode: '811105', policeStation: 'Sheikhpura Muffasil P.S.' },
  { district: 'sheikhpura', pincode: '811105', policeStation: 'Ariari P.S.' },
  { district: 'sheikhpura', pincode: '811101', policeStation: 'Barbigha P.S.' },
  { district: 'sheikhpura', pincode: '811105', policeStation: 'Chewara P.S.' },
  { district: 'sheikhpura', pincode: '811105', policeStation: 'Ghatkusumba P.S.' },
  { district: 'sheikhpura', pincode: '811105', policeStation: 'Sheikhopur Sarai P.S.' },
  { district: 'sheohar', pincode: '843329', policeStation: 'Sheohar (Sadar) P.S.' },
  { district: 'sheohar', pincode: '843329', policeStation: 'Sheohar Muffasil P.S.' },
  { district: 'sheohar', pincode: '843329', policeStation: 'Piprahi P.S.' },
  { district: 'sheohar', pincode: '843329', policeStation: 'Purnahiya P.S.' },
  { district: 'sheohar', pincode: '843329', policeStation: 'Tariani P.S.' },
  { district: 'sheohar', pincode: '843329', policeStation: 'Dumri Katsari P.S.' },
  { district: 'sitamarhi', pincode: '843301', policeStation: 'Dumra (Sadar) P.S.' },
  { district: 'sitamarhi', pincode: '843302', policeStation: 'Sitamarhi Nagar P.S.' },
  { district: 'sitamarhi', pincode: '843320', policeStation: 'Bathnaha P.S.' },
  { district: 'sitamarhi', pincode: '843313', policeStation: 'Bajpatti P.S.' },
  { district: 'sitamarhi', pincode: '843317', policeStation: 'Belsand P.S.' },
  { district: 'sitamarhi', pincode: '843314', policeStation: 'Bokhara P.S.' },
  { district: 'sitamarhi', pincode: '843332', policeStation: 'Chorout P.S.' },
  { district: 'sitamarhi', pincode: '843328', policeStation: 'Nanpur P.S.' },
  { district: 'sitamarhi', pincode: '843324', policeStation: 'Parihar P.S.' },
  { district: 'sitamarhi', pincode: '843320', policeStation: 'Parsauni P.S.' },
  { district: 'sitamarhi', pincode: '843320', policeStation: 'Pupri P.S.' },
  { district: 'sitamarhi', pincode: '843327', policeStation: 'Riga P.S.' },
  { district: 'sitamarhi', pincode: '843311', policeStation: 'Runnisaidpur P.S.' },
  { district: 'sitamarhi', pincode: '843330', policeStation: 'Sonbarsa P.S.' },
  { district: 'sitamarhi', pincode: '843320', policeStation: 'Suppi P.S.' },
  { district: 'sitamarhi', pincode: '843320', policeStation: 'Mejorganj P.S.' },
  { district: 'sitamarhi', pincode: '843331', policeStation: 'Sursand P.S.' },
  { district: 'sitamarhi', pincode: '843313', policeStation: 'Bairgania P.S.' },
  { district: 'sitamarhi', pincode: '843332', policeStation: 'Charaut P.S.' },
  { district: 'siwan', pincode: '841226', policeStation: 'Siwan Nagar P.S.' },
  { district: 'siwan', pincode: '841226', policeStation: 'Siwan Muffasil P.S.' },
  { district: 'siwan', pincode: '841233', policeStation: 'Basantpur P.S.' },
  { district: 'siwan', pincode: '841232', policeStation: 'Bhagwanpur Hat P.S.' },
  { district: 'siwan', pincode: '841234', policeStation: 'Barharia P.S.' },
  { district: 'siwan', pincode: '841239', policeStation: 'Darauli P.S.' },
  { district: 'siwan', pincode: '841241', policeStation: 'Goreyakothi P.S.' },
  { district: 'siwan', pincode: '841238', policeStation: 'Guthni P.S.' },
  { district: 'siwan', pincode: '841236', policeStation: 'Hasanpura P.S.' },
  { district: 'siwan', pincode: '841232', policeStation: 'Hussainganj P.S.' },
  { district: 'siwan', pincode: '841237', policeStation: 'Andar P.S.' },
  { district: 'siwan', pincode: '841241', policeStation: 'Lakri Nabiganj P.S.' },
  { district: 'siwan', pincode: '841238', policeStation: 'Maharajganj P.S.' },
  { district: 'siwan', pincode: '841239', policeStation: 'Mairwa P.S.' },
  { district: 'siwan', pincode: '841232', policeStation: 'Nautan P.S.' },
  { district: 'siwan', pincode: '841231', policeStation: 'Pachrukhi P.S.' },
  { district: 'siwan', pincode: '841504', policeStation: 'Raghunathpur P.S.' },
  { district: 'siwan', pincode: '841226', policeStation: 'Siswan P.S.' },
  { district: 'siwan', pincode: '841236', policeStation: 'Ziradei P.S.' },
  { district: 'supaul', pincode: '852131', policeStation: 'Supaul (Sadar) P.S.' },
  { district: 'supaul', pincode: '852131', policeStation: 'Supaul Muffasil P.S.' },
  { district: 'supaul', pincode: '852137', policeStation: 'Basantpur P.S.' },
  { district: 'supaul', pincode: '852214', policeStation: 'Chhatapur P.S.' },
  { district: 'supaul', pincode: '852132', policeStation: 'Kishanpur P.S.' },
  { district: 'supaul', pincode: '852133', policeStation: 'Marauna P.S.' },
  { district: 'supaul', pincode: '847452', policeStation: 'Nirmali P.S.' },
  { district: 'supaul', pincode: '852139', policeStation: 'Pipra P.S.' },
  { district: 'supaul', pincode: '852139', policeStation: 'Pratapganj P.S.' },
  { district: 'supaul', pincode: '852111', policeStation: 'Raghopur P.S.' },
  { district: 'supaul', pincode: '852137', policeStation: 'Saraigarh Bhaptiahi P.S.' },
  { district: 'supaul', pincode: '852139', policeStation: 'Triveniganj P.S.' },
  { district: 'supaul', pincode: '852214', policeStation: 'Bhimnagar P.S.' },
  { district: 'vaishali', pincode: '844101', policeStation: 'Hajipur Town P.S.' },
  { district: 'vaishali', pincode: '844101', policeStation: 'Hajipur Muffasil P.S.' },
  { district: 'vaishali', pincode: '844102', policeStation: 'Industrial Area P.S.' },
  { district: 'vaishali', pincode: '844504', policeStation: 'Jandaha P.S.' },
  { district: 'vaishali', pincode: '844502', policeStation: 'Bidupur P.S.' },
  { district: 'vaishali', pincode: '844121', policeStation: 'Lalganj P.S.' },
  { district: 'vaishali', pincode: '844506', policeStation: 'Mahnar P.S.' },
  { district: 'vaishali', pincode: '844122', policeStation: 'Mahua P.S.' },
  { district: 'vaishali', pincode: '844124', policeStation: 'Patepur P.S.' },
  { district: 'vaishali', pincode: '844506', policeStation: 'Raghopur P.S.' },
  { district: 'vaishali', pincode: '844122', policeStation: 'Sahdei Buzurg P.S.' },
  { district: 'vaishali', pincode: '844128', policeStation: 'Vaishali P.S.' },
  { district: 'vaishali', pincode: '844114', policeStation: 'Bhagwanpur P.S.' },
  { district: 'vaishali', pincode: '844506', policeStation: 'Chehrakala P.S.' },
  { district: 'vaishali', pincode: '844506', policeStation: 'Desri P.S.' },
  { district: 'vaishali', pincode: '844118', policeStation: 'Goraul P.S.' },
  { district: 'vaishali', pincode: '844121', policeStation: 'Jarpatti P.S.' },
  { district: 'vaishali', pincode: '844504', policeStation: 'Rajapakar P.S.' },
  { district: 'vaishali', pincode: '844101', policeStation: 'Sarai P.S.' },
  { district: 'vaishali', pincode: '844502', policeStation: 'Bidupur (Kalyanpur) P.S.' },
  { district: 'west champaran', pincode: '845438', policeStation: 'Bettiah Nagar P.S.' },
  { district: 'west champaran', pincode: '845438', policeStation: 'Bettiah Muffasil P.S.' },
  { district: 'west champaran', pincode: '845101', policeStation: 'Bagaha Nagar P.S.' },
  { district: 'west champaran', pincode: '845101', policeStation: 'Bagaha Muffasil P.S.' },
  { district: 'west champaran', pincode: '845449', policeStation: 'Chanpatia P.S.' },
  { district: 'west champaran', pincode: '845454', policeStation: 'Narkatiaganj P.S.' },
  { district: 'west champaran', pincode: '845455', policeStation: 'Sikta P.S.' },
  { district: 'west champaran', pincode: '845453', policeStation: 'Lauria P.S.' },
  { district: 'west champaran', pincode: '845449', policeStation: 'Nautan P.S.' },
  { district: 'west champaran', pincode: '845452', policeStation: 'Jogapatti P.S.' },
  { district: 'west champaran', pincode: '845438', policeStation: 'Majhaulia P.S.' },
  { district: 'west champaran', pincode: '845454', policeStation: 'Gaunaha P.S.' },
  { district: 'west champaran', pincode: '845106', policeStation: 'Ramnagar P.S.' },
  { district: 'west champaran', pincode: '845106', policeStation: 'Bhitaha P.S.' },
  { district: 'west champaran', pincode: '845105', policeStation: 'Piprasi P.S.' },
  { district: 'west champaran', pincode: '845454', policeStation: 'Madhubani P.S.' },
  { district: 'west champaran', pincode: '845105', policeStation: 'Thakraha P.S.' },
  { district: 'west champaran', pincode: '845452', policeStation: 'Yogapatti P.S.' },
  { district: 'west champaran', pincode: '845438', policeStation: 'Bairia P.S.' },
  { district: 'west champaran', pincode: '845105', policeStation: 'Valmiki Nagar P.S.' }
];

const findBiharPoliceStation = (district, pincode) => {
  const normalizedDistrict = String(district || '').trim().toLowerCase()
  const normalizedPincode = String(pincode || '').replace(/\D/g, '')

  if (!normalizedDistrict || normalizedPincode.length !== 6) return ''

  const match = BIHAR_POLICE_STATIONS.find((entry) => (
    String(entry.district || '').trim().toLowerCase() === normalizedDistrict &&
    String(entry.pincode || '').replace(/\D/g, '') === normalizedPincode
  ))

  return match ? match.policeStation : ''
}

const findBiharByPincode = (pincode) => {
  const normalizedPincode = String(pincode || '').replace(/\D/g, '')
  if (normalizedPincode.length !== 6) return []
  return BIHAR_POLICE_STATIONS.filter((entry) => String(entry.pincode || '').replace(/\D/g, '') === normalizedPincode)
}

const resolveBiharLocationDetails = (state, district, pincode) => {
  if (String(state || '').trim() !== 'Bihar') return null

  const normalizedPincode = String(pincode || '').replace(/\D/g, '')
  if (normalizedPincode.length !== 6) return null

  const normalizedDistrict = String(district || '').trim().toLowerCase()
  let match = null

  if (normalizedDistrict) {
    match = BIHAR_POLICE_STATIONS.find((entry) => (
      String(entry.district || '').trim().toLowerCase() === normalizedDistrict &&
      String(entry.pincode || '').replace(/\D/g, '') === normalizedPincode
    ))
  }

  if (!match) {
    const fallbackMatches = findBiharByPincode(normalizedPincode)
    if (fallbackMatches.length > 0) {
      match = fallbackMatches[0]
    }
  }

  if (!match) return null

  return {
    district: toTitleCase(String(match.district || '')),
    nearestPoliceStation: match.policeStation,
    nearestPoliceStationPincode: String(match.pincode || '').replace(/\D/g, '')
  }
}

const toTitleCase = (s) => {
  if (!s) return ''
  return s.split(/\s+/).map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ')
}

const calculateAge = (dob) => {
  if (!dob) return ''
  const [year, month, day] = dob.split('-').map(Number)
  if (!year || !month || !day) return ''
  const today = new Date()
  const birthDate = new Date(year, month - 1, day)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }
  return age >= 0 ? age : ''
}

const Step2Profile = ({ isActive, formData, updateFormData, onNext, onPrev, showToast }) => {
  const [emailVerified, setEmailVerified] = useState(formData.emailVerified || false)
  const [emailVerificationSkipped, setEmailVerificationSkipped] = useState(formData.emailVerificationSkipped || false)

  const areas = AREA_OPTIONS
  const languages = LANGUAGE_OPTIONS
  const genders = GENDER_OPTIONS
  const educationLevels = EDUCATION_LEVEL_OPTIONS
  const districtOptions = BIHAR_DISTRICT_OPTIONS
  const isBiharState = String(formData.state || '').trim() === 'Bihar'
  const loading = false

  const selectInputs = useRef({})
  const handleInputChange = (field) => (v, { action }) => { if (action === 'input-change') selectInputs.current[field] = v }
  const handleSelectBlur = (field, isMulti = false) => () => {
    const val = selectInputs.current[field]
    if (val) {
      if (isMulti) {
        const current = formData[field] || []
        if (!current.includes(val)) updateFormData({ [field]: [...current, val] })
      } else {
        updateFormData({ [field]: val })
      }
      selectInputs.current[field] = ''
    }
  }

  const CustomDropdownIndicator = (props) => {
    const { selectProps } = props;
    const isMobile = window.innerWidth <= 768;
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {selectProps.inputValue && isMobile && (
          <div 
            style={{ padding: '0 5px', cursor: 'pointer', color: 'var(--teal)' }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const val = selectProps.inputValue;
              if (selectProps.isMulti) {
                const currentValues = selectProps.value || [];
                selectProps.onChange([...currentValues, { label: val, value: val }], { action: 'create-option' });
              } else {
                selectProps.onChange({ label: val, value: val }, { action: 'create-option' });
              }
            }}
          >
            <i className="fas fa-check-circle" style={{ fontSize: '18px' }}></i>
          </div>
        )}
        <components.DropdownIndicator {...props} />
      </div>
    );
  };

  const toastRef = useRef(showToast)
  const autoFilledPoliceStationRef = useRef('')

  useEffect(() => {
    toastRef.current = showToast
  }, [showToast])

  useEffect(() => {
    if (String(formData.state || '').trim() !== 'Bihar') {
      autoFilledPoliceStationRef.current = ''
      return
    }

    const pincode = String(formData.pincode || '').replace(/\D/g, '')
    if (pincode.length !== 6) {
      if (!formData.nearestPoliceStation) autoFilledPoliceStationRef.current = ''
      return
    }

    const inferred = resolveBiharLocationDetails(formData.state, formData.district, pincode)
    if (!inferred) {
      if (!formData.nearestPoliceStation) autoFilledPoliceStationRef.current = ''
      return
    }

    const updates = {}
    const currentDistrictNormalized = String(formData.district || '').trim().toLowerCase()
    const inferredDistrictNormalized = String(inferred.district || '').trim().toLowerCase()
    if (!currentDistrictNormalized || currentDistrictNormalized !== inferredDistrictNormalized) {
      updates.district = inferred.district
    }
    if (formData.nearestPoliceStation !== inferred.nearestPoliceStation) updates.nearestPoliceStation = inferred.nearestPoliceStation
    if (formData.nearestPoliceStationPincode !== inferred.nearestPoliceStationPincode) updates.nearestPoliceStationPincode = inferred.nearestPoliceStationPincode

    if (Object.keys(updates).length) {
      autoFilledPoliceStationRef.current = inferred.nearestPoliceStation
      updateFormData(updates)
      return
    }

    autoFilledPoliceStationRef.current = inferred.nearestPoliceStation
  }, [formData.state, formData.district, formData.pincode, formData.nearestPoliceStation, formData.nearestPoliceStationPincode, updateFormData])

  const handleAreaChange = (selected) => {
    updateFormData({ area: selected ? selected.value : '' })
  }

  const handleLanguagesChange = (selected) => {
    const values = selected ? selected.map(s => s.value) : []
    updateFormData({ languages: values })
  }

  const handleGenderChange = (selected) => {
    updateFormData({ gender: selected ? selected.value : '' })
  }

  const handleStateChange = (selected) => {
    const state = selected ? selected.value : ''
    const updates = { state }

    if (state === 'Bihar') {
      const pincode = String(formData.pincode || '').replace(/\D/g, '')
      const inferred = resolveBiharLocationDetails(state, formData.district, pincode)
      if (inferred) {
        const currentDistrictNormalized = String(formData.district || '').trim().toLowerCase()
        const inferredDistrictNormalized = String(inferred.district || '').trim().toLowerCase()
        if (!currentDistrictNormalized || currentDistrictNormalized !== inferredDistrictNormalized) {
          updates.district = inferred.district
        }
        updates.nearestPoliceStation = inferred.nearestPoliceStation
        updates.nearestPoliceStationPincode = inferred.nearestPoliceStationPincode
      }
    }

    updateFormData(updates)
  }

  const autofillFromPincode = (pincodeVal) => {
    const pincode = String(pincodeVal || '').replace(/\D/g, '')
    const inferred = resolveBiharLocationDetails(formData.state, formData.district, pincode)
    if (!inferred) return

    const currentDistrictNormalized = String(formData.district || '').trim().toLowerCase()
    const inferredDistrictNormalized = String(inferred.district || '').trim().toLowerCase()
    const updates = {}
    if (!currentDistrictNormalized || currentDistrictNormalized !== inferredDistrictNormalized) {
      updates.district = inferred.district
    }
    updates.nearestPoliceStation = inferred.nearestPoliceStation
    updates.nearestPoliceStationPincode = inferred.nearestPoliceStationPincode
    updateFormData(updates)
    if (toastRef.current) toastRef.current('✅', 'Autofilled Bihar district and police station details')
  }

  const handleEmailVerify = (status) => {
    setEmailVerified(status)
    if (status) {
      setEmailVerificationSkipped(false)
      updateFormData({ emailVerified: status, emailVerificationSkipped: false })
    } else {
      updateFormData({ emailVerified: status })
    }
  }

  const handleNearestPoliceStationPincodeChange = (value) => {
    updateFormData({ nearestPoliceStationPincode: value.replace(/\D/g, '').slice(0, 6) })
  }

  const handleSkipEmailVerification = () => {
    setEmailVerificationSkipped(true)
    setEmailVerified(false)
    updateFormData({ emailVerified: false, emailVerificationSkipped: true })
  }

  const handleContinue = () => {
    if (!emailVerified) {
      return showToast('⚠️', 'Please verify your email address to continue')
    }

    const digipin = normalizeDigipin(formData.digipin)
    if (digipin !== formData.digipin) updateFormData({ digipin })

    const result = step2ProfileSchema.safeParse({
      firstName: formData.firstName,
      lastName: formData.lastName,
      fatherName: formData.fatherName,
      dob: formData.dob,
      gender: formData.gender,
      education: formData.education,
      email: formData.email,
      whatsapp: formData.whatsapp,
      presentAddress: formData.presentAddress,
      permanentAddress: formData.permanentAddress,
      pincode: formData.pincode,
      digipin,
      district: formData.district,
      state: formData.state,
      area: formData.area,
      customArea: formData.customArea,
      languages: formData.languages || [],
      customLanguages: formData.customLanguages,
      jobTypes: formData.jobTypes,
      customJobTypes: formData.customJobTypes,
      nearestPoliceStation: formData.nearestPoliceStation,
      nearestPoliceStationPincode: formData.nearestPoliceStationPincode,
      declaration: formData.declaration,
    })

    if (!result.success) {
      const error = result.error.issues[0]
      return showToast('⚠️', error?.message || 'Please fix the highlighted fields')
    }

    onNext()
  }

  if (!isActive) return null

  return (
    <div className="reg-step-content active">
      <LoadingOverlay active={false} message="" />

      <div className="reg-step-header" style={{marginBottom: "12px"}}>
        <div className="rsh-title">👤 Your Basic Profile</div>
        <div style={{ color: 'var(--text3)', fontSize: '13px', marginBottom: '20px' }}>
        This helps us match you to the right jobs
      </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">First Name *</label>
          <input
            className="form-control"
            placeholder="e.g. Arjun"
            value={formData.firstName || ''}
            onChange={(e) => updateFormData({ firstName: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Last Name *</label>
          <input
            className="form-control"
            placeholder="e.g. Kumar"
            value={formData.lastName || ''}
            onChange={(e) => updateFormData({ lastName: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Father's Name *</label>
          <input
            className="form-control"
            placeholder="e.g. Rajesh"
            value={formData.fatherName || ''}
            onChange={(e) => updateFormData({ fatherName: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Date of Birth *</label>
            {formData.dob && (
              <span style={{ color: 'var(--teal)', fontSize: '12px', fontWeight: 600, background: 'var(--teal-light)', padding: '2px 8px', borderRadius: '4px' }}>
                {calculateAge(formData.dob)} Years
              </span>
            )}
          </div>
          <input
            className="form-control"
            type="date"
            value={formData.dob || ''}
            onChange={(e) => updateFormData({ dob: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Gender *</label>
          <CreatableSelect
            options={genders}
            value={formData.gender ? (genders.find(g => g.value === formData.gender) || { label: formData.gender, value: formData.gender }) : null}
            onChange={handleGenderChange}
            onInputChange={handleInputChange('gender')}
            onBlur={handleSelectBlur('gender')}
            placeholder="Select gender"
            isClearable
            components={{ DropdownIndicator: CustomDropdownIndicator }}
          />
        </div>
        {isBiharState && (
          <div className="form-group">
            <label className="form-label">Highest Education *</label>
            <CreatableSelect
              options={educationLevels}
              value={formData.education ? (educationLevels.find(e => e.value === formData.education) || { label: formData.education, value: formData.education }) : null}
              onChange={(selected) => updateFormData({ education: selected ? selected.value : '' })}
              onInputChange={handleInputChange('education')}
              onBlur={handleSelectBlur('education')}
              placeholder="Select education level"
              isClearable
              components={{ DropdownIndicator: CustomDropdownIndicator }}
            />
          </div>
        )}
        <div className="form-group email-verify-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Email Address *</label>
            <EmailVerification 
              email={formData.email} 
              onVerify={handleEmailVerify} 
              showToast={showToast} 
              isVerified={emailVerified} 
            />
          </div>
          <input
            className={`form-control ${emailVerified ? 'is-verified' : ''}`}
            type="email"
            placeholder="arjun@email.com"
            value={formData.email || ''}
            onChange={(e) => {
              updateFormData({ email: e.target.value })
              if (emailVerified) handleEmailVerify(false)
              if (emailVerificationSkipped) {
                setEmailVerificationSkipped(false)
                updateFormData({ emailVerificationSkipped: false })
              }
            }}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">WhatsApp Number</label>
          <input
            className="form-control"
            type="tel"
            placeholder="9876543210"
            value={formData.whatsapp || ''}
            onChange={(e) => updateFormData({ whatsapp: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            maxLength="10"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Present Address *</label>
          <textarea
            className="form-control"
            placeholder="Flat / house / street address (current residing address)"
            rows="3"
            value={formData.presentAddress || ''}
            onChange={(e) => updateFormData({ presentAddress: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Permanent Address</label>
          <textarea
            className="form-control"
            placeholder="Flat / house / street address (if different from present address)"
            rows="3"
            value={formData.permanentAddress || ''}
            onChange={(e) => updateFormData({ permanentAddress: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Pincode * (Present address)</label>
          <input
            className="form-control"
            type="tel"
            placeholder="600001"
            maxLength="6"
            value={formData.pincode || ''}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6)
              updateFormData({ pincode: val })
              // Attempt autofill immediately when user finishes entering a Bihar pincode
              if (val.length === 6) autofillFromPincode(val)
            }}
          />
        </div>
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>DIGIPIN</label>
            <a
              href="https://dac.indiapost.gov.in/mydigipin/home"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--teal)', fontSize: '12px', fontWeight: 600 }}
            >
              Find your DIGIPIN
            </a>
          </div>
          <input
            className="form-control"
            type="text"
            placeholder="Enter your 10-character DIGIPIN"
            value={formData.digipin || ''}
            onChange={(e) => updateFormData({ digipin: normalizeDigipin(e.target.value) })}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">State *</label>
          <Select
            options={INDIAN_STATES}
            value={formData.state ? (INDIAN_STATES.find(s => s.value === formData.state) || { label: formData.state, value: formData.state }) : null}
            onChange={handleStateChange}
            placeholder="Select your state"
            isClearable
            components={{ DropdownIndicator: CustomDropdownIndicator }}
            required
          />
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label className="form-label" style={{ marginBottom: 0 }}>Nearest Police Station *</label>
            {String(formData.state || '').trim() === 'Bihar' && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  const pincode = String(formData.pincode || '').replace(/\D/g, '')
                  if (String(formData.state || '').trim() !== 'Bihar' || pincode.length !== 6) {
                    return showToast('⚠️', 'Autofill works only for Bihar with a valid 6-digit pincode')
                  }

                  // Prefer exact district+pincode, else use first match by pincode
                  let pick = null
                  const districtVal = String(formData.district || '').trim()
                  if (districtVal) {
                    pick = BIHAR_POLICE_STATIONS.find((entry) =>
                      String(entry.district || '').trim().toLowerCase() === districtVal.toLowerCase() &&
                      String(entry.pincode || '').replace(/\D/g, '') === pincode
                    )
                  }
                  if (!pick) {
                    const matches = findBiharByPincode(pincode)
                    if (matches.length) pick = matches[0]
                  }

                  if (!pick) return showToast('⚠️', 'No autofill data found for this pincode')

                  const inferredDistrict = toTitleCase(String(pick.district || ''))
                  const inferredStation = pick.policeStation
                  const updates = {}
                  if (!formData.district || String(formData.district).trim().length === 0) updates.district = inferredDistrict
                  updates.nearestPoliceStation = inferredStation
                  updates.nearestPoliceStationPincode = String(pick.pincode || '').replace(/\D/g, '')
                  updateFormData(updates)
                  showToast('✅', 'Autofilled Bihar district and police station details')
                }}
              >
                Autofill
              </button>
            )}
          </div>
          <input
            className="form-control"
            placeholder="Enter nearest police station"
            value={formData.nearestPoliceStation || ''}
            onChange={(e) => updateFormData({ nearestPoliceStation: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Nearest Police Station Pincode *</label>
          <input
            className="form-control"
            type="tel"
            placeholder="600001"
            maxLength="6"
            value={formData.nearestPoliceStationPincode || ''}
            onChange={(e) => handleNearestPoliceStationPincodeChange(e.target.value)}
          />
        </div>

        {String(formData.state || '').trim() === 'Bihar' && (
          <>
            <div className="form-group">
              <label className="form-label">District *</label>
              <CreatableSelect
                options={districtOptions}
                value={formData.district ? (districtOptions.find(d => d.value === formData.district) || { label: formData.district, value: formData.district }) : null}
                onChange={(selected) => updateFormData({ district: selected ? selected.value : '' })}
                onInputChange={handleInputChange('district')}
                onBlur={handleSelectBlur('district')}
                placeholder="Select or type your district"
                isClearable
                components={{ DropdownIndicator: CustomDropdownIndicator }}
              />
              <div style={{ fontSize: '12px', color: '#8899AA', marginTop: '5px' }}>
                Type a district and press Enter to add it manually.
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Declaration *</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={!!formData.declaration}
                  onChange={(e) => updateFormData({ declaration: e.target.checked })}
                />
                <div style={{ marginLeft: 8, fontSize: '13px' }}>
                  I hereby declare that these details will be used for police verification purposes.
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/*
      <div className="form-group">
        <label className="form-label">Your Home Area / Locality *</label>
        <CreatableSelect
          options={areas}
          value={formData.area ? (areas.find(a => a.value === formData.area) || { label: formData.area, value: formData.area }) : null}
          onChange={handleAreaChange}
          onInputChange={handleInputChange('area')}
          onBlur={handleSelectBlur('area')}
          placeholder="Select your area"
          isClearable
          components={{ DropdownIndicator: CustomDropdownIndicator }}
        />
      </div>
      */}
      <div className="form-group">
        <label className="form-label">Your Home Area / Locality *</label>
        <input
          className="form-control"
          placeholder="Enter your area or locality"
          value={formData.area || ''}
          onChange={(e) => updateFormData({ area: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Languages Known *</label>
        <CreatableSelect
          isMulti
          options={languages}
          value={formData.languages?.map(lang => ({ label: lang, value: lang })) || []}
          onChange={handleLanguagesChange}
          onInputChange={handleInputChange('languages')}
          onBlur={handleSelectBlur('languages', true)}
          placeholder="Type and press Enter to add languages"
          components={{ DropdownIndicator: CustomDropdownIndicator }}
        />
        <div style={{ fontSize: '12px', color: '#8899AA', marginTop: '5px' }}>
          Type a language and press Enter to add, or select from dropdown
        </div>
      </div>

      <div className="action-row">
        <button className="btn btn-secondary btn-sm" onClick={onPrev}>
          Back
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleContinue}>
          Continue
        </button>
      </div>
    </div>
  )
}

export default Step2Profile

export { BIHAR_POLICE_STATIONS }
