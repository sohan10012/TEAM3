import os
import sys
import time
import subprocess
import shutil
from playwright.sync_api import sync_playwright

OUTPUT_DIR = "/home/Sohan/PROJECTS/tracetest-ai/docs/reports/screen_recording"
RAW_VIDEO_DIR = f"{OUTPUT_DIR}/raw_video"
FINAL_MP4 = f"{OUTPUT_DIR}/tracetest_end_to_end_walkthrough.mp4"
FINAL_WEBM = f"{OUTPUT_DIR}/tracetest_end_to_end_walkthrough.webm"
SRT_FILE = f"{OUTPUT_DIR}/tracetest_walkthrough_captions.srt"

# Ensure directories exist and clean old raw recordings
if os.path.exists(RAW_VIDEO_DIR):
    shutil.rmtree(RAW_VIDEO_DIR)
os.makedirs(RAW_VIDEO_DIR, exist_ok=True)

# -------------------------------------------------------------
# Caption HUD Injection Script (Runs on every page load)
# -------------------------------------------------------------
INIT_SCRIPT = """
window.__captionData = {
    stage: 'STARTING',
    title: 'TraceTest Autonomous Quality Engineering',
    desc: 'Initializing live walk-through...',
    step: '1 of 10'
};

function ensureCaptionHUD() {
    let hud = document.getElementById('tracetest-caption-hud');
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'tracetest-caption-hud';
        hud.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            width: min(940px, 92vw);
            background: rgba(15, 23, 42, 0.94);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 16px;
            padding: 13px 22px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255,255,255,0.06);
            color: #F8FAFC;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            z-index: 999999;
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        `;
        hud.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span id="hud-stage-badge" style="
                        background: #1D63ED;
                        color: white;
                        font-size: 10px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.08em;
                        padding: 3px 9px;
                        border-radius: 6px;
                    ">STAGE 1</span>
                    <span id="hud-title" style="
                        font-size: 14px;
                        font-weight: 700;
                        color: #FFFFFF;
                        letter-spacing: -0.01em;
                    ">Title</span>
                </div>
                <span id="hud-timer" style="
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                    font-size: 11px;
                    color: #94A3B8;
                    font-weight: 600;
                    background: rgba(255,255,255,0.06);
                    padding: 2px 8px;
                    border-radius: 4px;
                ">Step 1 of 10</span>
            </div>
            <p id="hud-desc" style="
                margin: 0;
                font-size: 12px;
                line-height: 1.48;
                color: #CBD5E1;
            ">Description</p>
        `;
        document.body.appendChild(hud);
    }
    
    // Update contents
    const b = hud.querySelector('#hud-stage-badge');
    const t = hud.querySelector('#hud-title');
    const d = hud.querySelector('#hud-desc');
    const s = hud.querySelector('#hud-timer');
    if (b) b.innerText = window.__captionData.stage;
    if (t) t.innerText = window.__captionData.title;
    if (d) d.innerText = window.__captionData.desc;
    if (s) s.innerText = window.__captionData.step;
}

window.setCaptionHUD = function(stage, title, desc, step) {
    window.__captionData = { stage, title, desc, step };
    ensureCaptionHUD();
};

window.showClickRipple = function(x, y) {
    const ripple = document.createElement('div');
    ripple.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        width: 28px;
        height: 28px;
        transform: translate(-50%, -50%) scale(0.4);
        border-radius: 50%;
        border: 2px solid #38BDF8;
        background: rgba(56, 189, 248, 0.35);
        pointer-events: none;
        z-index: 999998;
        transition: all 0.4s ease-out;
    `;
    document.body.appendChild(ripple);
    requestAnimationFrame(() => {
        ripple.style.transform = 'translate(-50%, -50%) scale(2.2)';
        ripple.style.opacity = '0';
    });
    setTimeout(() => ripple.remove(), 450);
};

window.addEventListener('DOMContentLoaded', ensureCaptionHUD);
setInterval(ensureCaptionHUD, 500);
"""

# Safe helper to update HUD via Playwright argument passing (avoids string escaping issues)
def set_hud(page, stage, title, desc, step):
    page.evaluate(
        """(args) => {
            window.setCaptionHUD(args.stage, args.title, args.desc, args.step);
        }""",
        {"stage": stage, "title": title, "desc": desc, "step": step}
    )

# Helper to smooth scroll
def smooth_scroll(page, delta_y, duration_sec=1.5):
    steps = 15
    delay = duration_sec / steps
    dy = delta_y / steps
    for _ in range(steps):
        page.evaluate(f"window.scrollBy(0, {dy})")
        time.sleep(delay)

def click_element_with_ripple(page, selector):
    try:
        loc = page.locator(selector).first
        if loc.is_visible():
            box = loc.bounding_box()
            if box:
                cx = box["x"] + box["width"] / 2
                cy = box["y"] + box["height"] / 2
                page.evaluate(f"window.showClickRipple({cx}, {cy})")
                time.sleep(0.15)
            loc.click()
            time.sleep(0.5)
            return True
    except Exception as e:
        print(f"Click notice for {selector}: {e}")
    return False

# Format seconds to SRT time string (HH:MM:SS,mmm)
def to_srt_time(seconds):
    millis = int((seconds - int(seconds)) * 1000)
    secs = int(seconds) % 60
    mins = int(seconds / 60) % 60
    hours = int(seconds / 3600)
    return f"{hours:02d}:{mins:02d}:{secs:02d},{millis:03d}"

def record_walkthrough():
    print("=" * 70)
    print("TRACETEST AI — RECORDING 5-6 MIN END-TO-END WALKTHROUGH")
    print("=" * 70)

    srt_entries = []
    current_time_sec = 0.0

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path="/usr/bin/chromium",
            headless=True,
            args=[
                "--disable-gpu",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--font-render-hinting=none"
            ]
        )

        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=RAW_VIDEO_DIR,
            record_video_size={"width": 1920, "height": 1080}
        )

        page = context.new_page()
        page.add_init_script(INIT_SCRIPT)

        # Set default active project to 13 (FLSA_PAY)
        page.goto("http://127.0.0.1:5173/projects")
        page.wait_for_selector("h1", timeout=15000)
        page.evaluate("() => localStorage.setItem('tracetest.project', '13')")
        time.sleep(1)

        # -------------------------------------------------------------
        # SCENE 1: Workspace Portfolio & Dashboard (25s)
        # -------------------------------------------------------------
        start_t = current_time_sec
        stage_title = "STAGE 1: WORKSPACE & PROJECT PORTFOLIO"
        heading = "Enterprise Quality Engineering Management"
        desc = "Welcome to TraceTest AI. Enterprise teams manage requirements, statutory policies, and automated verification suites across production workspaces with continuous audit integrity."
        
        print(f"[{time.strftime('%H:%M:%S')}] Executing Scene 1: {heading} (25s)")
        set_hud(page, stage_title, heading, desc, "Step 1 of 10")
        time.sleep(4)
        
        smooth_scroll(page, 280, 2.0)
        time.sleep(5)
        smooth_scroll(page, -280, 2.0)
        time.sleep(4)

        # Click into FLSA Payroll project
        click_element_with_ripple(page, "text=FLSA Payroll Compliance Evaluation")
        time.sleep(8)

        end_t = start_t + 25.0
        current_time_sec = end_t
        srt_entries.append((1, start_t, end_t, heading, desc))

        # -------------------------------------------------------------
        # SCENE 2: Document-First Intake & Ingestion (30s)
        # -------------------------------------------------------------
        start_t = current_time_sec
        stage_title = "STAGE 2: DOCUMENT-FIRST INTAKE"
        heading = "Statutory Document Ingestion & Cryptographic Provenance"
        desc = "Instead of tedious manual data entry, TraceTest ingests authentic regulatory publications. Here, the U.S. DOL FLSA Digital Reference Guide (30 pages) is parsed with cryptographic SHA-256 verification."
        
        print(f"[{time.strftime('%H:%M:%S')}] Executing Scene 2: {heading} (30s)")
        page.goto("http://127.0.0.1:5173/requirements?project_id=13")
        page.wait_for_selector("text=Requirements", timeout=15000)
        set_hud(page, stage_title, heading, desc, "Step 2 of 10")
        time.sleep(4)

        # Inspect Document Intake tab
        click_element_with_ripple(page, "button:has-text('Document Intake')")
        time.sleep(3)
        smooth_scroll(page, 320, 2.0)
        time.sleep(12)
        smooth_scroll(page, -320, 2.0)
        time.sleep(9)

        end_t = start_t + 30.0
        current_time_sec = end_t
        srt_entries.append((2, start_t, end_t, heading, desc))

        # -------------------------------------------------------------
        # SCENE 3: Statutory Clause Decomposition (30s)
        # -------------------------------------------------------------
        start_t = current_time_sec
        stage_title = "STAGE 3: CLAUSE DECOMPOSITION"
        heading = "Atomic Statutory Decomposition & Provenance Citations"
        desc = "TraceTest automatically breaks down statutory documents into 41 atomic obligation clauses with zero dropped text. Every extracted clause retains exact document, section, and page citations."
        
        print(f"[{time.strftime('%H:%M:%S')}] Executing Scene 3: {heading} (30s)")
        set_hud(page, stage_title, heading, desc, "Step 3 of 10")
        time.sleep(4)

        # Click Decompose Clauses tab if available
        click_element_with_ripple(page, "button:has-text('Decompose Clauses'), button:has-text('Clarifications')")
        time.sleep(4)
        smooth_scroll(page, 300, 2.0)
        time.sleep(12)
        smooth_scroll(page, -300, 2.0)
        time.sleep(8)

        end_t = start_t + 30.0
        current_time_sec = end_t
        srt_entries.append((3, start_t, end_t, heading, desc))

        # -------------------------------------------------------------
        # SCENE 4: Requirements Ledger & Gherkin ACs (40s)
        # -------------------------------------------------------------
        start_t = current_time_sec
        stage_title = "STAGE 4: REQUIREMENTS & ACCEPTANCE CRITERIA"
        heading = "Enterprise Requirements Hierarchy & Given/When/Then ACs"
        desc = "36 formal business requirements are generated. Notice the expandable row hierarchy: each requirement displays verbatim statutory quotations, 95% extraction confidence, and derived Gherkin acceptance criteria."
        
        print(f"[{time.strftime('%H:%M:%S')}] Executing Scene 4: {heading} (40s)")
        set_hud(page, stage_title, heading, desc, "Step 4 of 10")
        
        # Switch to Extracted Requirements tab
        click_element_with_ripple(page, "button:has-text('Extracted Requirements')")
        time.sleep(3)

        # Expand the first requirement row
        click_element_with_ripple(page, "button:has-text('Expand All')")
        time.sleep(4)
        smooth_scroll(page, 380, 2.5)
        time.sleep(14)
        smooth_scroll(page, 400, 2.5)
        time.sleep(12)
        smooth_scroll(page, -780, 2.0)
        time.sleep(5)

        end_t = start_t + 40.0
        current_time_sec = end_t
        srt_entries.append((4, start_t, end_t, heading, desc))

        # -------------------------------------------------------------
        # SCENE 5: 10-Category Test Suite Synthesis (45s)
        # -------------------------------------------------------------
        start_t = current_time_sec
        stage_title = "STAGE 5: 10-CATEGORY TEST DESIGN"
        heading = "Exhaustive Multi-Category Test Suite Synthesis"
        desc = "TraceTest synthesizes 360 automated test cases across all 10 quality engineering categories (36 per category). Interactive category chips display dynamic rationale cards for Boundary Value, Security, and Business Rules."
        
        print(f"[{time.strftime('%H:%M:%S')}] Executing Scene 5: {heading} (45s)")
        page.goto("http://127.0.0.1:5173/tests?project_id=13")
        page.wait_for_selector("text=Test Cases", timeout=15000)
        set_hud(page, stage_title, heading, desc, "Step 5 of 10")
        time.sleep(4)

        # Click through Category Chips
        click_element_with_ripple(page, "button:has-text('Boundary Value')")
        time.sleep(6)
        smooth_scroll(page, 250, 1.5)
        time.sleep(6)

        click_element_with_ripple(page, "button:has-text('Security')")
        time.sleep(6)

        click_element_with_ripple(page, "button:has-text('Business Rule')")
        time.sleep(6)

        click_element_with_ripple(page, "button:has-text('All Tests')")
        time.sleep(5)
        smooth_scroll(page, -250, 1.5)
        time.sleep(12)

        end_t = start_t + 45.0
        current_time_sec = end_t
        srt_entries.append((5, start_t, end_t, heading, desc))

        # -------------------------------------------------------------
        # SCENE 6: Multi-Tier Execution & Behavioral Simulation (35s)
        # -------------------------------------------------------------
        start_t = current_time_sec
        stage_title = "STAGE 6: MULTI-TIER EXECUTION"
        heading = "In-Memory Behavior Simulation vs Statutory Policy Validation"
        desc = "TraceTest distinguishes in-memory behavior simulation from statutory specification validation. Run SIM-000004 passed 360 of 360 state transitions (100%), while policy validation VAL-000002 uncovered 20 statutory assertion failures."
        
        print(f"[{time.strftime('%H:%M:%S')}] Executing Scene 6: {heading} (35s)")
        page.goto("http://127.0.0.1:5173/executions?project_id=13")
        page.wait_for_selector("h1", timeout=15000)
        set_hud(page, stage_title, heading, desc, "Step 6 of 10")
        time.sleep(4)

        smooth_scroll(page, 320, 2.0)
        time.sleep(14)
        smooth_scroll(page, -320, 2.0)
        time.sleep(15)

        end_t = start_t + 35.0
        current_time_sec = end_t
        srt_entries.append((6, start_t, end_t, heading, desc))

        # -------------------------------------------------------------
        # SCENE 7: Defect Forensics & Root Cause Analysis (40s)
        # -------------------------------------------------------------
        start_t = current_time_sec
        stage_title = "STAGE 7: DEFECT FORENSICS & RCA"
        heading = "Root Cause Analysis: FLSA Section 3(m) Tip Credit Shortfall"
        desc = "Validation failures correlate directly to regulatory defects. DEF-FLSA_PAY-0001 details that the payroll engine took the $5.12 tip credit subminimum without verifying that employee tips met the federal $7.25/hr minimum wage."
        
        print(f"[{time.strftime('%H:%M:%S')}] Executing Scene 7: {heading} (40s)")
        page.goto("http://127.0.0.1:5173/defects?project_id=13")
        page.wait_for_selector("text=DEF-FLSA_PAY-0001", timeout=15000)
        set_hud(page, stage_title, heading, desc, "Step 7 of 10")
        time.sleep(5)

        # Click defect row to inspect details
        click_element_with_ripple(page, "text=DEF-FLSA_PAY-0001")
        time.sleep(5)
        smooth_scroll(page, 280, 2.0)
        time.sleep(15)
        smooth_scroll(page, -280, 2.0)
        time.sleep(13)

        end_t = start_t + 40.0
        current_time_sec = end_t
        srt_entries.append((7, start_t, end_t, heading, desc))

        # -------------------------------------------------------------
        # SCENE 8: 6-Stage Traceability Verification Chain (35s)
        # -------------------------------------------------------------
        start_t = current_time_sec
        stage_title = "STAGE 8: BIDIRECTIONAL TRACEABILITY"
        heading = "Interactive 6-Stage Traceability Verification Chain"
        desc = "Continuous proof chain: Source Doc (1) → Requirements (36) → Acceptance Criteria (72) → Test Cases (360) → Execution (360) → Defects (1). The With Defects filter immediately isolates affected requirements."
        
        print(f"[{time.strftime('%H:%M:%S')}] Executing Scene 8: {heading} (35s)")
        page.goto("http://127.0.0.1:5173/traceability?project_id=13")
        page.wait_for_selector("text=Interactive Traceability Verification Chain", timeout=15000)
        set_hud(page, stage_title, heading, desc, "Step 8 of 10")
        time.sleep(4)

        # Click With Defects filter button
        click_element_with_ripple(page, "button:has-text('With Defects')")
        time.sleep(5)
        smooth_scroll(page, 350, 2.0)
        time.sleep(12)
        smooth_scroll(page, -350, 2.0)
        time.sleep(12)

        end_t = start_t + 35.0
        current_time_sec = end_t
        srt_entries.append((8, start_t, end_t, heading, desc))

        # -------------------------------------------------------------
        # SCENE 9: Executive Quality Intelligence Report & Go/No-Go (45s)
        # -------------------------------------------------------------
        start_t = current_time_sec
        stage_title = "STAGE 9: EXECUTIVE QUALITY INTELLIGENCE"
        heading = "Deterministic Release Gate Decision: CONDITIONAL / NO-GO"
        desc = "The consolidated Intelligence Report evaluates readiness across 4 deterministic pillars. Status: NO-GO / RELEASE BLOCKED. While simulation passed 100%, release is gated until defect DEF-FLSA_PAY-0001 is remediated."
        
        print(f"[{time.strftime('%H:%M:%S')}] Executing Scene 9: {heading} (45s)")
        page.goto("http://127.0.0.1:5173/intelligence-report?project_id=13")
        page.wait_for_selector("text=Quality Intelligence Report", timeout=15000)
        set_hud(page, stage_title, heading, desc, "Step 9 of 10")
        time.sleep(5)

        # Inspect 10 Test Categories tab
        click_element_with_ripple(page, "button:has-text('10 Test Categories')")
        time.sleep(6)
        smooth_scroll(page, 320, 2.0)
        time.sleep(6)

        # Inspect Execution Breakdown tab
        click_element_with_ripple(page, "button:has-text('Execution Breakdown')")
        time.sleep(6)

        # Inspect Defects & RCA tab
        click_element_with_ripple(page, "button:has-text('Defects & RCA')")
        time.sleep(8)
        smooth_scroll(page, -320, 2.0)
        time.sleep(12)

        end_t = start_t + 45.0
        current_time_sec = end_t
        srt_entries.append((9, start_t, end_t, heading, desc))

        # -------------------------------------------------------------
        # SCENE 10: Multi-Format Export Ecosystem & Conclusion (20s)
        # -------------------------------------------------------------
        start_t = current_time_sec
        stage_title = "STAGE 10: CONTINUOUS COMPLIANCE DOSSIER"
        heading = "Multi-Format Export Ecosystem (Markdown, JSON, PDF)"
        desc = "TraceTest exports complete quality audit dossiers in Markdown, JSON, and multi-page print-optimized PDF. Delivering full end-to-end quality assurance from raw regulatory text to verified production readiness."
        
        print(f"[{time.strftime('%H:%M:%S')}] Executing Scene 10: {heading} (20s)")
        set_hud(page, stage_title, heading, desc, "Step 10 of 10")
        time.sleep(4)

        # Scroll to top to show action buttons
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(14)

        end_t = start_t + 20.0
        current_time_sec = end_t
        srt_entries.append((10, start_t, end_t, heading, desc))

        print(f"Recording complete! Total duration: {current_time_sec:.1f} seconds ({current_time_sec/60:.2f} minutes)")

        # Close context to flush video to disk
        context.close()
        browser.close()

    # -------------------------------------------------------------
    # Write SRT Subtitles File
    # -------------------------------------------------------------
    print(f"Writing subtitle file: {SRT_FILE}")
    with open(SRT_FILE, "w", encoding="utf-8") as f:
        for idx, s_t, e_t, h, d in srt_entries:
            f.write(f"{idx}\n")
            f.write(f"{to_srt_time(s_t)} --> {to_srt_time(e_t)}\n")
            f.write(f"<b>{h}</b>\n")
            f.write(f"{d}\n\n")

    # -------------------------------------------------------------
    # Locate recorded WebM file
    # -------------------------------------------------------------
    video_files = [os.path.join(RAW_VIDEO_DIR, f) for f in os.listdir(RAW_VIDEO_DIR) if f.endswith(".webm")]
    if not video_files:
        print("ERROR: No recorded webm file found in RAW_VIDEO_DIR!")
        return

    latest_webm = max(video_files, key=os.path.getctime)
    print(f"Found master WebM recording: {latest_webm} ({os.path.getsize(latest_webm)} bytes)")

    # Copy to FINAL_WEBM
    subprocess.run(["cp", latest_webm, FINAL_WEBM], check=True)
    print(f"Saved master WebM to: {FINAL_WEBM}")

    # -------------------------------------------------------------
    # Convert to High-Bitrate Universal MP4 with FFmpeg
    # -------------------------------------------------------------
    print("Transcoding to universal 1080p MP4 with FFmpeg...")
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-i", latest_webm,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        FINAL_MP4
    ]
    subprocess.run(ffmpeg_cmd, check=True)
    print(f"Successfully generated 1080p MP4: {FINAL_MP4} ({os.path.getsize(FINAL_MP4)} bytes)")
    print("=" * 70)
    print("ALL ASSETS SUCCESSFULLY GENERATED!")
    print(f"1. MP4 Video: {FINAL_MP4}")
    print(f"2. Master WebM: {FINAL_WEBM}")
    print(f"3. SRT Subtitles: {SRT_FILE}")
    print("=" * 70)

if __name__ == "__main__":
    record_walkthrough()
