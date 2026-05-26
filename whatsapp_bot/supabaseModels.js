// supabaseModels.js
// Helper functions to interact with Supabase tables for the WhatsApp Bot.
// All functions return Promises that resolve to the data or throw on error.

const { supabase } = require('./supabase');

/** Templates */
async function getAllTemplates() {
  const { data, error } = await supabase.from('templates').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function getTemplateById(id) {
  const { data, error } = await supabase.from('templates').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function createTemplate(template) {
  // template: { name, message, type, poll_options, image_path, cloudinary_id }
  const { data, error } = await supabase.from('templates').insert([template]).select().single();
  if (error) throw error;
  return data;
}

async function updateTemplate(id, updates) {
  const { data, error } = await supabase.from('templates').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteTemplate(id) {
  // First delete any campaigns that reference this template to avoid FK violations
  const { error: campaignDelErr } = await supabase.from('campaigns').delete().eq('template_id', id);
  if (campaignDelErr) throw campaignDelErr;
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) throw error;
  return true;
}
// Business Info helpers

async function getBusinessInfo() {
  const { data, error } = await supabase.from('business_info').select('*').limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const row = data[0];
  return {
    id: row.id,
    about_us: row.about_us,
    aboutUs: row.about_us,
    products: row.products,
    faq: row.faq,
    refund_policy: row.refund_policy,
    refundPolicy: row.refund_policy,
    contact: row.contact
  };
}

async function upsertBusinessInfo(info) {
  const mapped = {
    about_us: info.aboutUs || info.about_us || '',
    products: info.products || '',
    faq: info.faq || '',
    refund_policy: info.refundPolicy || info.refund_policy || '',
    contact: info.contact || ''
  };

  // Find existing record id to update the single row
  const { data: existing } = await supabase.from('business_info').select('id').limit(1);
  if (existing && existing.length > 0) {
    mapped.id = existing[0].id;
  }

  const { data, error } = await supabase.from('business_info').upsert([mapped]).select().single();
  if (error) throw error;
  return {
    id: data.id,
    about_us: data.about_us,
    aboutUs: data.about_us,
    products: data.products,
    faq: data.faq,
    refund_policy: data.refund_policy,
    refundPolicy: data.refund_policy,
    contact: data.contact
  };
}

/** Campaigns */
async function insertCampaign(campaign) {
  const { data, error } = await supabase.from('campaigns').insert([campaign]).select().single();
  if (error) throw error;
  return data;
}

async function getAllCampaigns() {
  const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Contact Lists */
async function createContactList(list) {
  const { data, error } = await supabase.from('contact_lists').insert([list]).select().single();
  if (error) throw error;
  return data;
}

async function getAllContactLists() {
  const { data, error } = await supabase.from('contact_lists').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function getContactListById(id) {
  const { data, error } = await supabase.from('contact_lists').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function deleteContactList(id) {
  // Delete child contacts first to prevent foreign key constraint violations
  const { error: contactsError } = await supabase.from('contacts').delete().eq('list_id', id);
  if (contactsError) throw contactsError;

  const { error } = await supabase.from('contact_lists').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// Update usage stats for a contact list
async function updateContactListUsage(id) {
  const { data, error } = await supabase.from('contact_lists')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  return true;
}

/** Contacts */
async function insertContacts(contacts) {
  const { data, error } = await supabase.from('contacts').insert(contacts).select();
  if (error) throw error;
  return data;
}

async function getContactsByListId(listId) {
  const { data, error } = await supabase.from('contacts').select('*').eq('list_id', listId).order('name', { ascending: true });
  if (error) throw error;
  return data;
}

module.exports = {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getBusinessInfo,
  upsertBusinessInfo,
  insertCampaign,
  getAllCampaigns,
  createContactList,
  getAllContactLists,
  getContactListById,
  deleteContactList,
  insertContacts,
  getContactsByListId,
  updateContactListUsage,
};
