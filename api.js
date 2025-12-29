export async function canvasFetch(path) {
  const { canvasToken, canvasBaseUrl } = await chrome.storage.sync.get(["canvasToken", "canvasBaseUrl"]);

  if (!canvasToken || !canvasBaseUrl) throw new Error("Canvas token or base URL not set.");

  const res = await fetch(`${canvasBaseUrl}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${canvasToken}` }
  });

  if (!res.ok) throw new Error(`Canvas API error ${res.status}: ${res.statusText}`);
  return res;
}

export async function fetchAllPages(path) {
  let results = [];
  let url = path;

  while (url) {
    const res = await canvasFetch(url);
    results.push(...await res.json());

    const link = res.headers.get("Link");
    url = link?.match(/<([^>]+)>;\s*rel="next"/)?.[1]?.replace(/^https:\/\/[^/]+\/api\/v1/, "") || null;
  }

  return results;
}

export async function getAssignments(courseId) {
  return await fetchAllPages(`/courses/${courseId}/assignments?per_page=100&include[]=submission`);
}

export function normalizeAssignments(assignments, course) {
  const now = new Date();

  return assignments
    .filter(a => {
      if (!a.due_at) return false;
      const due = new Date(a.due_at);
      const sub = a.submission;
      const notSubmitted = !sub || sub.workflow_state === "unsubmitted";
      const pastDue = !sub || sub.missing === true;
      const upcoming = due >= now;
      return notSubmitted && (pastDue || upcoming);
    })
    .map(a => ({
      id: a.id,
      name: a.name,
      due: new Date(a.due_at),
      courseId: course.id,
      courseName: course.name,
      color: course.color || "#666666",
      url: a.html_url
    }));
}

export async function loadSelectedAssignments(courseIds = []) {
  // Load courses with their colors from storage
  const { courses: storedCourses } = await chrome.storage.sync.get(["courses"]);
  const courses = [];

  for (const id of courseIds) {
    try {
      const res = await canvasFetch(`/courses/${id}`);
      const course = await res.json();

      // Assign user-defined color
      const storedCourse = storedCourses?.find(c => c.id === id);
      course.color = storedCourse?.color || "#666666";

      courses.push(course);
    } catch (err) {
      console.error(`Failed to fetch course ${id}:`, err);
    }
  }

  // Fetch all assignments in parallel
  const assignmentsByCourse = await Promise.all(
    courses.map(course =>
      getAssignments(course.id)
        .then(assignments => normalizeAssignments(assignments, course))
        .catch(err => {
          console.error(`Failed to fetch assignments for course ${course.id}:`, err);
          return [];
        })
    )
  );

  return assignmentsByCourse.flat().sort((a, b) => a.due - b.due);
}
