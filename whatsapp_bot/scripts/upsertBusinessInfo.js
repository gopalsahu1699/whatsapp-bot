const { supabase } = require('../supabase');
const fs = require('fs').promises;
const path = require('path');

async function main() {
  try {
    const data = await fs.readFile(path.join(__dirname, '..', 'business_info.json'), 'utf8');
    const json = JSON.parse(data);
    // Map camelCase keys to snake_case column names expected by Supabase
    const mapped = {
      about_us: json.aboutUs || json.about_us,
      products: json.products,
      faq: json.faq,
      refund_policy: json.refundPolicy || json.refund_policy,
      contact: json.contact
    };
    const { data: upserted, error } = await supabase.from('business_info').upsert([mapped]).single();
    if (error) throw error;
    console.log('Business info upserted successfully:', upserted);
  } catch (err) {
    console.error('Error upserting business info:', err.message);
    process.exit(1);
  }
}

main();
