const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️  Supabase URL or Key is missing in environment variables.');
    console.log('DEBUG SUPABASE_URL:', supabaseUrl);
    console.log('DEBUG SUPABASE_KEY:', supabaseKey);
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

module.exports = { supabase };
