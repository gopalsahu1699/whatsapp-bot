const fs = require('fs');
const path = require('path');

class SupabaseAuthStore {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
    }

    async sessionExists({ session }) {
        try {
            const { data, error } = await this.supabase
                .from('whatsapp_sessions')
                .select('id')
                .eq('id', session)
                .single();
            if (error || !data) return false;
            return true;
        } catch (err) {
            return false;
        }
    }

    async save({ session }) {
        try {
            const userDataDir = path.join(process.cwd(), '.wwebjs_auth');
            const zipPath = path.join(userDataDir, `${session}.zip`);
            
            // Wait 1.5 seconds to ensure file locks are released by the OS/Puppeteer
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            if (!fs.existsSync(zipPath)) {
                console.warn(`[SupabaseStore] No session zip found at ${zipPath} to save.`);
                return; // Skip saving when zip is not created yet
            }

            const fileBuffer = fs.readFileSync(zipPath);
            const base64Data = fileBuffer.toString('base64');

            const { error } = await this.supabase
                .from('whatsapp_sessions')
                .upsert({ 
                    id: session, 
                    session_data: base64Data,
                    updated_at: new Date().toISOString()
                });

            if (error) {
                console.error('[SupabaseStore] Failed to save session to Supabase:', error.message);
            } else {
                console.log(`[SupabaseStore] Session ${session} successfully backed up to Supabase.`);
            }
        } catch (err) {
            console.error('[SupabaseStore] Error during save:', err.message);
        }
    }

    async extract({ session }) {
        try {
            const userDataDir = path.join(process.cwd(), '.wwebjs_auth');
            const zipPath = path.join(userDataDir, `${session}.zip`);

            if (!fs.existsSync(userDataDir)) {
                fs.mkdirSync(userDataDir, { recursive: true });
            }

            const { data, error } = await this.supabase
                .from('whatsapp_sessions')
                .select('session_data')
                .eq('id', session)
                .single();

            if (error || !data) {
                console.warn(`[SupabaseStore] No session data found for ${session} to extract.`);
                return false;
            }

            const fileBuffer = Buffer.from(data.session_data, 'base64');
            fs.writeFileSync(zipPath, fileBuffer);
            console.log(`[SupabaseStore] Session ${session} successfully extracted from Supabase.`);
            return true;
        } catch (err) {
            console.error('[SupabaseStore] Error during extract:', err.message);
            return false;
        }
    }

    async delete({ session }) {
        try {
            const { error } = await this.supabase
                .from('whatsapp_sessions')
                .delete()
                .eq('id', session);
            if (error) {
                console.error(`[SupabaseStore] Failed to delete session ${session} from Supabase:`, error.message);
            } else {
                console.log(`[SupabaseStore] Session ${session} successfully deleted from Supabase.`);
            }
        } catch (err) {
            console.error('[SupabaseStore] Error during delete:', err.message);
        }
    }
}

module.exports = { SupabaseAuthStore };
