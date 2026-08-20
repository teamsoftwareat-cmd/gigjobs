import { z } from 'zod'

/* ===== AUTH SCHEMAS ===== */
export const loginSchema = z.object({
  username: z
    .string()
    .min(3, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    mobile: z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string(),
    role: z.enum(['candidate', 'recruiter', 'client']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/* ===== CANDIDATE SCHEMAS ===== */
export const candidateProfileSchema = z.object({
  fullName: z.string().min(2, 'Name is required'),
  dob: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['Male', 'Female', 'Other']),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  email: z.string().email('Enter a valid email'),
  location: z.string().min(2, 'Location is required'),
  travelRadius: z.coerce.number().min(1).max(100),
  expectedRate: z.string().min(1, 'Expected rate is required'),
  education: z.string().min(2, 'Education is required'),
})

/* ===== ADD CANDIDATE SCHEMA ===== */
export const addCandidateSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces'),

  email: z
    .string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters'),

  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number starting with 6-9'),

  whatsapp: z
    .string()
    .optional()
    .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
      message: 'Enter a valid 10-digit WhatsApp number starting with 6-9',
    }),

  aadhaarNumber: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{12}$/.test(val), {
      message: 'Aadhaar number must be exactly 12 digits',
    }),

  fatherName: z
    .string()
    .optional()
    .refine((val) => !val || val.trim().length === 0 || (val.trim().length >= 2 && val.trim().length <= 100), {
      message: 'Father name must be between 2-100 characters',
    })
    .refine((val) => !val || val.trim().length === 0 || /^[a-zA-Z\s]+$/.test(val), {
      message: 'Father name can only contain letters and spaces',
    }),

  location: z
    .enum(['Tambaram', 'Velachery', 'Guindy', 'OMR', 'Anna Nagar'], {
      errorMap: () => ({ message: 'Please select a valid location' }),
    }),

  presentAddress: z
    .string()
    .optional()
    .refine((val) => !val || val.trim().length === 0 || val.trim().length >= 10, {
      message: 'Present address must be at least 10 characters',
    })
    .refine((val) => !val || val.trim().length <= 500, {
      message: 'Present address must be less than 500 characters',
    }),

  permanentAddress: z
    .string()
    .optional()
    .refine((val) => !val || val.trim().length === 0 || val.trim().length >= 10, {
      message: 'Permanent address must be at least 10 characters',
    })
    .refine((val) => !val || val.trim().length <= 500, {
      message: 'Permanent address must be less than 500 characters',
    }),

  dateOfJoining: z
    .string()
    .min(1, 'Date of joining is required')
    .refine((val) => {
      const date = new Date(val)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return date >= today
    }, {
      message: 'Date of joining cannot be in the past',
    }),
})

/* ===== JOB POST SCHEMA ===== */
export const postJobSchema = z.object({
  title: z.string().min(3, 'Job title is required'),
  segment: z.enum(['Part-Time', 'Internship', 'Temporary']),
  location: z.string().min(2, 'Location is required'),
  headcount: z.coerce.number().min(1, 'At least 1 position required'),
  shift: z.string().min(1, 'Shift is required'),
  dailyRate: z.coerce.number().min(100, 'Rate must be at least ₹100'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  skills: z.string().min(3, 'Skills are required'),
})

/* ===== INVOICE SCHEMA ===== */
export const invoiceSchema = z.object({
  client: z.string().min(2, 'Client is required'),
  period: z.string().min(2, 'Period is required'),
  manDays: z.coerce.number().min(1, 'Man days must be at least 1'),
  ratePerDay: z.coerce.number().min(100, 'Rate must be at least ₹100'),
  dueDate: z.string().min(1, 'Due date is required'),
})

/* ===== JOB APPLICATION SCHEMA ===== */
export const applyJobSchema = z.object({
  relevantExperience: z.string().optional(),
  keySkills: z.string().optional(),
  availabilityNote: z.string().optional(),
  preferredStartDate: z.string().min(1, 'Preferred start date is required'),
})

/* ===== ADD STAFF USER SCHEMA ===== */
export const addUserSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  role: z.string().min(1, 'Role is required'),
})

/* ===== INTERNAL USER CREATION SCHEMA ===== */
export const createInternalUserSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    mobileNumber: z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number starting with 6-9'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string(),
    role: z.enum(['admin', 'recruiter', 'accounts', 'client'], 'Please select a valid role'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/* ===== REGISTRATION SCHEMAS ===== */
export const step1MobileSchema = z.object({
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number starting with 6-9'),
  referralCode: z.string().optional(),
})

export const step2ProfileSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(1, 'Last name must be at least 1 characters'),
  dob: z.string().min(1, 'Date of birth is required'),
  gender: z.string().min(1, 'Gender is required'),
  education: z.string().optional(),
  email: z.string().email('Please enter a valid email address'),
  fatherName: z
    .string()
    .refine((val) => val.trim().length > 0, 'Father name is required')
    .refine((val) => val.trim().length >= 2, 'Father name must be at least 2 characters')
    .refine((val) => val.trim().length <= 100, 'Father name must be less than 100 characters')
    .refine((val) => /^[a-zA-Z\s]+$/.test(val), 'Father name can only contain letters and spaces'),
  whatsapp: z
    .string()
    .optional()
    .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
      message: 'Enter a valid 10-digit WhatsApp number starting with 6-9',
    }),
  presentAddress: z
    .string()
    .refine((val) => val.trim().length > 0, 'Present address is required')
    .refine((val) => val.trim().length >= 5, 'Present address must be at least 5 characters')
    .refine((val) => val.trim().length <= 500, 'Present address must be less than 500 characters'),
  permanentAddress: z
    .string()
    .optional()
    .refine((val) => !val || val.trim().length === 0 || val.trim().length >= 5, {
      message: 'Permanent address must be at least 5 characters',
    })
    .refine((val) => !val || val.trim().length <= 500, {
      message: 'Permanent address must be less than 500 characters',
    }),
  pincode: z
    .string()
    .regex(/^[0-9]{6}$/, 'Enter a valid 6-digit pincode'),
  state: z.string().min(1, 'State is required'),
  area: z.string().min(1, 'Area is required'),
  customArea: z.string().optional(),
  languages: z.array(z.string()).min(1, 'At least one language is required'),
  customLanguages: z.array(z.string()).optional(),
  jobTypes: z.array(z.string()).optional(),
  customJobTypes: z.array(z.string()).optional(),
  nearestPoliceStation: z.string().optional(),
  nearestPoliceStationPincode: z.string().optional().refine((val) => !val || /^[0-9]{6}$/.test(val), { message: 'Enter a valid 6-digit pincode' }),
  declaration: z.boolean().optional(),
})
.superRefine((data, ctx) => {
  if (!data.nearestPoliceStation || String(data.nearestPoliceStation).trim().length === 0) {
    ctx.addIssue({ path: ['nearestPoliceStation'], code: z.ZodIssueCode.custom, message: 'Nearest police station is required' })
  }
  if (!data.nearestPoliceStationPincode || !/^[0-9]{6}$/.test(String(data.nearestPoliceStationPincode))) {
    ctx.addIssue({ path: ['nearestPoliceStationPincode'], code: z.ZodIssueCode.custom, message: 'Nearest police station pincode is required' })
  }
  if (String(data.state || '').trim() === 'Bihar' && data.declaration !== true) {
    ctx.addIssue({ path: ['declaration'], code: z.ZodIssueCode.custom, message: 'You must accept the declaration for Bihar' })
  }
})

export const step3EducationSchema = z.object({
  education: z.string().min(1, 'Education level is required'),
  customEducation: z.string().optional(),
  college: z.string().min(2, 'College name is required'),
  degree: z.string().optional(),
  completionYear: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{4}-\d{2}$/.test(val), {
      message: 'Completion year must be in YYYY-MM format',
    }),
  skills: z.array(z.string()).min(1, 'At least one skill is required'),
  customSkills: z.array(z.string()).optional(),
  customShift: z.string().optional(),
  resume: z.any().optional(), // File validation can be handled separately
})

export const step4EmploymentSchema = z.object({
  currentStatus: z.enum(['Student', 'Working', 'Fresher', 'Other'], {
    errorMap: () => ({ message: 'Please select your current status' }),
  }),
  travelDistance: z.string().min(1, 'Travel distance is required'),
  jobTypes: z.array(z.string()).min(1, 'At least one job type is required'),
  shiftPreference: z.string().min(1, 'Shift preference is required'),
  expectedDailyRate: z.string().min(1, 'Expected daily rate is required'),
  preferredField: z.string().min(2, 'Preferred work field is required'),
  previousWorkDetails: z.string().optional(),
  employmentNotes: z.string().optional(),
  currentCompany: z.string().optional().refine((val) => !val || val.trim().length >= 2, {
    message: 'Company name must be at least 2 characters',
  }),
  yearsOfExperience: z.string().optional().refine((val) => !val || /^\d+(\.\d+)?$/.test(val), {
    message: 'Enter a valid number for years of experience',
  }),
  currentCTC: z.string().optional().refine((val) => !val || /^[\d.,]+$/.test(val), {
    message: 'Enter a valid CTC amount',
  }),
}).refine((data) => {
  if (data.currentStatus === 'Fresher') return true
  return String(data.previousWorkDetails || '').trim().length >= 5
}, {
  message: 'Please enter your previous work details',
  path: ['previousWorkDetails'],
})

export const step5KYCSchema = z.object({
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, 'Aadhaar number must be exactly 12 digits'),
  aadhaarNumberConfirm: z
    .string()
    .regex(/^\d{12}$/, 'Confirmation Aadhaar number must be exactly 12 digits'),
  panNumber: z
    .string()
    .optional()
    .refine((val) => !val || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val), {
      message: 'Enter a valid PAN number',
    }),
  bankAccount: z
    .string()
    .optional()
    .refine((val) => !val || val.trim().length >= 9, {
      message: 'Bank account number must be at least 9 digits',
    }),
  ifscCode: z
    .string()
    .optional()
    .refine((val) => !val || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(val), {
      message: 'Enter a valid IFSC code',
    }),
  bankName: z.string().optional(),
  accountHolderName: z.string().optional(),
  profilePhoto: z.any().refine((val) => !!val, {
    message: 'Profile photo is required',
  }),
  aadhaarFront: z.any().refine((val) => !!val, {
    message: 'Aadhaar front image is required',
  }),
  aadhaarBack: z.any().refine((val) => !!val, {
    message: 'Aadhaar back image is required',
  }),
}).refine((data) => data.aadhaarNumber === data.aadhaarNumberConfirm, {
  message: 'Aadhaar numbers do not match',
  path: ['aadhaarNumberConfirm'],
}).refine((data) => {
  const hasBankInfo = !!data.bankAccount || !!data.ifscCode || !!data.bankName || !!data.accountHolderName
  if (!hasBankInfo) return true
  return !!data.bankAccount && !!data.ifscCode && !!data.accountHolderName
}, {
  message: 'Complete all bank details when bank information is provided',
  path: ['bankAccount'],
})

/* ===== SUPPORT TICKET SCHEMA ===== */
export const supportTicketSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),

  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number starting with 6-9'),

  email: z
    .string()
    .email('Please enter a valid email address'),

  category: z
    .string()
    .min(1, 'Please select an issue category'),

  priority: z
    .enum(['low', 'normal', 'high', 'urgent'])
    .default('normal'),

  subject: z
    .string()
    .min(5, 'Subject must be at least 5 characters')
    .max(100, 'Subject must be less than 100 characters'),

  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(5000, 'Description must be less than 5000 characters'),

  attachments: z
    .array(z.any())
    .optional()
    .refine((files) => !files || files.length <= 5, {
      message: 'Maximum 5 attachments allowed',
    })
    .refine((files) => {
      if (!files) return true
      return files.every((file) => file.size <= 5242880) // 5MB
    }, {
      message: 'Each file must be less than 5MB',
    }),
})
