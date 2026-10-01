const GHL_TOKEN = process.env.GHL_TOKEN;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const GHL_API = 'https://rest.gohighlevel.com/v1';

export async function syncCustomerToGHL(customer: {id: string; name: string; email: string; phone: string}) {
  if (!GHL_TOKEN || !GHL_LOCATION_ID) {
    console.warn('GHL_TOKEN or GHL_LOCATION_ID not configured');
    return null;
  }

  try {
    const response = await fetch(`${GHL_API}/contacts/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GHL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locationId: GHL_LOCATION_ID,
        firstName: customer.name.split(' ')[0],
        lastName: customer.name.split(' ').slice(1).join(' '),
        email: customer.email,
        phone: customer.phone
      })
    });

    if (!response.ok) {
      console.error(`GHL sync failed: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.contact?.id;
  } catch (error) {
    console.error('GHL sync error:', error);
    return null;
  }
}

export async function createJobPipelineEntry(customerId: string, jobDetails: {number: number; description: string; trade: string}) {
  if (!GHL_TOKEN || !GHL_LOCATION_ID) {
    console.warn('GHL_TOKEN or GHL_LOCATION_ID not configured');
    return null;
  }

  try {
    const response = await fetch(`${GHL_API}/opportunities/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GHL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locationId: GHL_LOCATION_ID,
        contactId: customerId,
        title: `Job #${jobDetails.number} - ${jobDetails.trade}`,
        description: jobDetails.description,
        pipelineStageId: 'new_lead'
      })
    });

    if (!response.ok) {
      console.error(`GHL opportunity creation failed: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.opportunity?.id;
  } catch (error) {
    console.error('GHL opportunity creation error:', error);
    return null;
  }
}

export async function addGHLNote(opportunityId: string, note: string) {
  if (!GHL_TOKEN) {
    console.warn('GHL_TOKEN not configured');
    return null;
  }

  try {
    const response = await fetch(`${GHL_API}/opportunities/${opportunityId}/notes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GHL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        value: note
      })
    });

    if (!response.ok) {
      console.error(`GHL note creation failed: ${response.statusText}`);
      return null;
    }

    return true;
  } catch (error) {
    console.error('GHL note creation error:', error);
    return null;
  }
}

export async function syncJobCompletionToGHL(
  ghlContactId: string,
  jobDetails: {number: number; description: string; trade: string; status: string}
) {
  if (!GHL_TOKEN || !GHL_LOCATION_ID) {
    console.warn('GHL_TOKEN or GHL_LOCATION_ID not configured');
    return null;
  }

  try {
    // Create opportunity for completed job
    const oppResponse = await fetch(`${GHL_API}/opportunities/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GHL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locationId: GHL_LOCATION_ID,
        contactId: ghlContactId,
        title: `Completed: Job #${jobDetails.number} - ${jobDetails.trade}`,
        description: jobDetails.description,
        status: 'won',
        pipelineStageId: 'completed'
      })
    });

    if (!oppResponse.ok) {
      console.error(`GHL completion sync failed: ${oppResponse.statusText}`);
      return null;
    }

    const oppData = await oppResponse.json();
    return oppData.opportunity?.id;
  } catch (error) {
    console.error('GHL completion sync error:', error);
    return null;
  }
}