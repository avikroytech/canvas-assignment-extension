import { loadSelectedAssignments } from "./api.js";

// Helper to set text color for contrast on background
function getTextColor(bgColor) {
  const hex = bgColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 125 ? "#000000" : "#FFFFFF";
}

document.addEventListener("DOMContentLoaded", init);

async function init() {
  // Load saved token, baseUrl, and courses
  const data = await chrome.storage.sync.get(["canvasToken", "canvasBaseUrl", "courses"]);

  document.getElementById("token").value = data.canvasToken || "";
  document.getElementById("baseUrl").value = data.canvasBaseUrl || "";

  if (data.courses) {
    data.courses.forEach((course, index) => {
      const idInput = document.getElementById(`course${index + 1}`);
      const colorInput = document.getElementById(`color${index + 1}`);
      if (idInput) idInput.value = course.id;
      if (colorInput) colorInput.value = course.color || "#666666";
    });
  }

  // Save button
  document.getElementById("save").onclick = async () => {
    const token = document.getElementById("token").value;
    const baseUrl = document.getElementById("baseUrl").value;

    const courses = [];
    const courseIds = [];

    for (let i = 1; i <= 6; i++) {
      const id = document.getElementById(`course${i}`).value.trim();
      const color = document.getElementById(`color${i}`).value || "#666666";
      if (id) {
        courses.push({ id, color });
        courseIds.push(id);
      }
    }

    await chrome.storage.sync.set({ canvasToken: token, canvasBaseUrl: baseUrl, courses });

    loadAssignments(courseIds);
  };

  // Load assignments if saved data exists
  if (data.canvasToken && data.canvasBaseUrl && data.courses) {
    loadAssignments(data.courses.map(c => c.id));
  } else {
    document.getElementById("past-due").innerHTML = `
      <div class="text-center py-12 px-4">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-700/50 mb-4">
          <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
        </div>
        <p class="text-gray-400 text-lg">Enter your Canvas token, base URL, and course IDs above to get started.</p>
      </div>
    `;
    document.getElementById("upcoming").innerHTML = "";
  }
}

async function loadAssignments(courseIds) {
  const pastDueContainer = document.getElementById("past-due");
  const upcomingContainer = document.getElementById("upcoming");

  // Show loading state
  pastDueContainer.innerHTML = `
    <div class="text-center py-12 px-4">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
      <p class="text-gray-400">Loading assignments...</p>
    </div>
  `;
  upcomingContainer.innerHTML = "";

  try {
    const assignments = await loadSelectedAssignments(courseIds);
    render(assignments);
  } catch (err) {
    console.error(err);
    pastDueContainer.innerHTML = `
      <div class="text-center py-12 px-4">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
          <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <p class="text-red-400 text-lg font-medium mb-2">Failed to load assignments</p>
        <p class="text-gray-500 text-sm">Please check your Canvas token, base URL, and course IDs.</p>
      </div>
    `;
    upcomingContainer.innerHTML = "";
  }
}

function render(assignments) {
  const pastDueContainer = document.getElementById("past-due");
  const upcomingContainer = document.getElementById("upcoming");
  const pastDueCount = document.getElementById("past-due-count");
  const upcomingCount = document.getElementById("upcoming-count");

  pastDueContainer.innerHTML = "";
  upcomingContainer.innerHTML = "";

  const now = new Date();

  const pastDue = assignments.filter(a => a.due < now);
  const upcoming = assignments.filter(a => a.due >= now);

  pastDueCount.innerText = pastDue.length;
  upcomingCount.innerText = upcoming.length;

  const createCard = (a) => {
    const card = document.createElement("div");

    card.className = `
      group relative flex items-center justify-between
      rounded-xl border border-neutral-800 bg-neutral-900/80
      px-5 py-4 cursor-pointer transition
      hover:border-neutral-700 hover:bg-neutral-900
    `;

    const dueStr = a.due.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });

    card.innerHTML = `
      <div class="absolute left-0 top-0 h-full w-1 rounded-l-xl" style="background:${a.color}"></div>

      <div class="pl-4 min-w-0">
        <div class="text-sm font-semibold text-white truncate">
          ${a.name}
        </div>
        <div class="text-xs text-neutral-400 mt-0.5">
          ${a.courseName}
        </div>
      </div>

      <div class="ml-6 flex items-center gap-3">
        <div class="text-right">
          <div class="text-xs font-medium text-neutral-300 whitespace-nowrap">
            ${dueStr}
          </div>
        </div>
        <svg
          class="w-4 h-4 text-neutral-500 group-hover:text-neutral-300 group-hover:translate-x-1 transition"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    `;

    card.onclick = () => window.open(a.url, "_blank");
    return card;
  };


  if (pastDue.length === 0) {
    pastDueContainer.innerHTML = `
      <div class="text-center py-10 px-4 rounded-xl bg-gray-700/30 border border-gray-600/30">
        <p class="text-gray-400">No past due assignments. Great job!</p>
      </div>
    `;
  } else {
  pastDue.forEach(a => pastDueContainer.appendChild(createCard(a)));
  }

  if (upcoming.length === 0) {
    upcomingContainer.innerHTML = `
      <div class="text-center py-10 px-4 rounded-xl bg-gray-700/30 border border-gray-600/30">
        <p class="text-gray-400">No upcoming assignments.</p>
      </div>
    `;
  } else {
  upcoming.forEach(a => upcomingContainer.appendChild(createCard(a)));
  }
}
