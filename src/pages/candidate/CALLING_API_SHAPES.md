/**
 * CANDIDATE CALLING FEATURE - API JSON SHAPES
 * 
 * Two-page flow:
 * 1. CallingProjects.jsx - Shows list of project-locations
 * 2. CallingRecipients.jsx - Shows recipients for selected project-location
 */

// ============================================
// 1. GET ASSIGNED PROJECT-LOCATIONS
// ============================================
// Endpoint: GET /candidates/calling/projects-locations
// Description: Fetch list of projects and locations the candidate is assigned to
// Query Params: search?, offset?, limit?

// Response Format:
{
  "status": 200,
  "data": {
    "items": [
      {
        "id": "proj_loc_1",
        "projectId": "proj_1",
        "project": "Project A",
        "location": "Chennai",
        "locationId": "loc_1",
        "recipientCount": 25,
        "calledCount": 10,
        "pendingCount": 15,
        "createdAt": "2026-05-01T10:00:00Z"
      },
      {
        "id": "proj_loc_2",
        "projectId": "proj_2",
        "project": "Project B",
        "location": "Bangalore",
        "locationId": "loc_2",
        "recipientCount": 35,
        "calledCount": 20,
        "pendingCount": 15,
        "createdAt": "2026-04-28T10:00:00Z"
      }
    ],
    "total": 5
  }
}

// ============================================
// 2. GET RECIPIENTS FOR PROJECT-LOCATION
// ============================================
// Endpoint: GET /candidates/calling/recipients
// Description: Fetch recipients for a specific project-location
// Query Params: project (projectId), location, search?, from?, to?, offset?, limit?

// Response Format:
{
  "status": 200,
  "data": {
    "items": [
      {
        "id": "rec_1",
        "name": "John Doe",
        "phone": "9876543210",
        "mobile": "9876543210",
        "project": "Project A",
        "projectId": "proj_1",
        "location": "Chennai",
        "locationId": "loc_1",
        "status": "pending",
        "date": "2026-05-05"
      },
      {
        "id": "rec_2",
        "name": "Jane Smith",
        "phone": "9876543211",
        "mobile": "9876543211",
        "project": "Project A",
        "projectId": "proj_1",
        "location": "Chennai",
        "locationId": "loc_1",
        "status": "called",
        "date": "2026-05-05"
      }
    ],
    "total": 100
  }
}

// ============================================
// 3. MAKE CALL (POST)
// ============================================
// Endpoint: POST /candidates/calls/{recipientId}
// Description: Initiate a call to a recipient
// Request Body:
{
  "projectId": "proj_1",
  "location": "Chennai",
  "timestamp": "2026-05-05T14:30:00Z",
  "status": "initiated"
}

// Response Format:
{
  "status": 201,
  "data": {
    "callId": "call_1",
    "recipientId": "rec_1",
    "projectId": "proj_1",
    "location": "Chennai",
    "status": "initiated",
    "timestamp": "2026-05-05T14:30:00Z",
    "message": "Call initiated successfully"
  }
}

// ============================================
// 4. UPDATE RECIPIENT STATUS (POST)
// ============================================
// Endpoint: POST /candidates/recipients/{recipientId}/status
// Description: Update the call status of a recipient
// Request Body:
{
  "status": "called",
  "projectId": "proj_1",
  "location": "Chennai",
  "timestamp": "2026-05-05T14:35:00Z"
}

// Alternative status values:
// - "called"
// - "unanswered"
// - "busy"
// - "not interested"
// - "interested"
// - "callback requested"
// - "no answer"
// - "wrong number"
// - "follow up needed"
// - "others" (with custom text)

// Response Format:
{
  "status": 200,
  "data": {
    "recipientId": "rec_1",
    "previousStatus": "pending",
    "newStatus": "called",
    "projectId": "proj_1",
    "location": "Chennai",
    "timestamp": "2026-05-05T14:35:00Z",
    "message": "Status updated successfully"
  }
}

// ============================================
// ERROR RESPONSE FORMAT (All Endpoints)
// ============================================
{
  "status": 400,
  "error": "Bad Request",
  "message": "Invalid project ID or location",
  "data": null
}

// ============================================
// FLOW SUMMARY
// ============================================
// 1. User navigates to /app/candidate/calling
//    - Loads CallingProjects page
//    - Calls GET /candidates/calling/projects-locations
//    - Displays table with project-locations

// 2. User clicks "View Recipients →" on a project-location
//    - Navigates to /app/candidate/calling/recipients (with state)
//    - Calls GET /candidates/calling/recipients?project={projectId}&location={location}
//    - Displays recipients table

// 3. User clicks "📞 Call" button
//    - Shows confirmation dialog
//    - Calls POST /candidates/calls/{recipientId}
//    - Refreshes recipients list

// 4. User clicks on status to edit
//    - Inline status editor appears with dropdown
//    - User selects status and confirms
//    - Calls POST /candidates/recipients/{recipientId}/status
//    - Refreshes recipients list

// ============================================
