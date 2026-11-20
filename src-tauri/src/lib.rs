#[tauri::command]
fn get_platform_info() -> String {
    "Tauri Desktop Runtime (Steam-Ready Build v0.207)".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_platform_info])
        .run(tauri::generate_context!())
        .expect("error while running CYBER-SPORE 207 Tauri application");
}
