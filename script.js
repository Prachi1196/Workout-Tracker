// Cache DOM elements for the form, buttons, and display areas.
const exerciseInput = document.getElementById('exerciseInput');
const setsInput = document.getElementById('setsInput');
const repsInput = document.getElementById('repsInput');
const workoutList = document.getElementById('workoutList');
const summaryCount = document.getElementById('summaryCount');
const summaryReps = document.getElementById('summaryReps');
const personalBestText = document.getElementById('personalBestText');
const personalBestNumber = document.getElementById('personalBestNumber');
const personalBestDate = document.getElementById('personalBestDate');
const addButton = document.getElementById('addButton');
const saveButton = document.getElementById('saveButton');
const loadButton = document.getElementById('loadButton');
const themeToggle = document.getElementById('themeToggle');
const searchInput = document.getElementById('searchInput');
const dateFilterSelect = document.getElementById('dateFilter');
const goalInput = document.getElementById('goalInput');
const setGoalButton = document.getElementById('setGoalButton');
const goalProgressText = document.getElementById('goalProgressText');
const goalFill = document.getElementById('goalFill');
const chartCanvas = document.getElementById('progressChart');

// Storage keys for localStorage persistence.
const STORAGE_KEY = 'workouts';
const THEME_KEY = 'themeMode';
const GOAL_KEY = 'dailyGoal';

// App state variables.
let workouts = [];
let chart = null;
let dailyGoal = Number(localStorage.getItem(GOAL_KEY)) || 50;

// Initialize the app on page load.
function initApp() {
  loadTheme(); // Load saved theme preference.
  loadSavedWorkouts(false); // Load saved workouts without alert on first load.
  goalInput.value = dailyGoal; // Show the stored goal in the input.
  updateGoalProgress(); // Update goal progress bar immediately.
  updateUI(); // Render workouts, summary, chart, and best.
}

// Add a new workout to the list and refresh the UI.
function addWorkout() {
  const exercise = exerciseInput.value.trim();
  const sets = Number(setsInput.value);
  const reps = Number(repsInput.value);

  // Validate the input fields.
  if (!exercise || sets < 1 || reps < 1) {
    alert('Please fill in exercise name, sets, and reps.');
    return;
  }

  const now = new Date();

  // Create a workout object with current date info.
  const workout = {
    id: Date.now(),
    exercise,
    sets,
    reps,
    date: now.toLocaleDateString(),
    dateISO: now.toISOString(),
  };

  // Store the workout in the array.
  workouts.push(workout);

  // Clear inputs after adding.
  exerciseInput.value = '';
  setsInput.value = '';
  repsInput.value = '';

  updateUI();
  checkRestDay();
}

// Get workouts filtered by search and selected date filter.
function getFilteredWorkouts() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const filterType = dateFilterSelect.value;
  const today = new Date();

  return workouts
    .filter((workout) => workout.exercise.toLowerCase().includes(searchTerm))
    .filter((workout) => {
      if (filterType === 'today') {
        return isSameDay(new Date(workout.dateISO), today);
      }
      if (filterType === 'week') {
        return isSameWeek(new Date(workout.dateISO), today);
      }
      return true;
    })
    .sort((a, b) => new Date(b.dateISO) - new Date(a.dateISO));
}

// Render the workout list in the DOM.
function displayWorkouts() {
  const filteredWorkouts = getFilteredWorkouts();
  workoutList.innerHTML = ''; // Clear old list before updating.

  if (filteredWorkouts.length === 0) {
    const emptyState = document.createElement('li');
    emptyState.className = 'workout-item';
    emptyState.textContent = 'No workouts match your search or filter.';
    workoutList.appendChild(emptyState);
    return;
  }

  filteredWorkouts.forEach((workout) => {
    const item = document.createElement('li');
    item.className = 'workout-item';

    const details = document.createElement('div');
    details.className = 'item-details';

    const title = document.createElement('strong');
    title.textContent = workout.exercise;
    details.appendChild(title);

    const setsInfo = document.createElement('span');
    setsInfo.textContent = `Sets: ${workout.sets} • Reps: ${workout.reps}`;
    details.appendChild(setsInfo);

    const dateInfo = document.createElement('span');
    dateInfo.textContent = `Date: ${workout.date}`;
    details.appendChild(dateInfo);

    const actionPanel = document.createElement('div');
    actionPanel.className = 'workout-actions';

    const editButton = document.createElement('button');
    editButton.className = 'small-button edit';
    editButton.textContent = '✎';
    editButton.title = 'Edit workout';
    editButton.addEventListener('click', () => editWorkout(workout.id));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'small-button delete';
    deleteButton.textContent = '❌';
    deleteButton.title = 'Delete workout';
    deleteButton.addEventListener('click', () => deleteWorkout(workout.id));

    actionPanel.appendChild(editButton);
    actionPanel.appendChild(deleteButton);

    item.appendChild(details);
    item.appendChild(actionPanel);
    workoutList.appendChild(item);
  });
}

// Update the weekly summary values.
function updateSummary() {
  summaryCount.textContent = workouts.length;
  const totalReps = workouts.reduce((sum, workout) => sum + workout.sets * workout.reps, 0);
  summaryReps.textContent = totalReps;
}

// Calculate and display the personal best workout.
function updatePersonalBest() {
  if (workouts.length === 0) {
    personalBestNumber.textContent = '0';
    personalBestText.textContent = 'No personal best yet.';
    personalBestDate.textContent = 'Add a workout to unlock your first best set.';
    return;
  }

  const bestWorkout = workouts.reduce((best, current) => {
    const currentTotal = current.sets * current.reps;
    const bestTotal = best.sets * best.reps;
    return currentTotal > bestTotal ? current : best;
  }, workouts[0]);

  const totalReps = bestWorkout.sets * bestWorkout.reps;
  personalBestNumber.textContent = totalReps;
  personalBestText.textContent = `${bestWorkout.exercise} — ${bestWorkout.sets}×${bestWorkout.reps}`;
  personalBestDate.textContent = `Recorded on ${new Date(bestWorkout.dateISO).toLocaleDateString()}`;
}

// Update the daily goal progress bar.
function updateGoalProgress() {
  const today = new Date();
  const todaysReps = workouts.reduce((sum, workout) => {
    return isSameDay(new Date(workout.dateISO), today) ? sum + workout.sets * workout.reps : sum;
  }, 0);

  const progress = dailyGoal > 0 ? Math.min((todaysReps / dailyGoal) * 100, 100) : 0;
  goalProgressText.textContent = `${todaysReps} / ${dailyGoal} reps today`;
  goalFill.style.width = `${progress}%`;
}

// Render the Chart.js line chart for reps over time.
function renderChart() {
  chartCanvas.style.width = '100%';
  chartCanvas.style.height = '280px';
  chartCanvas.style.maxHeight = '360px';

  const grouped = workouts.reduce((acc, workout) => {
    const dateKey = workout.dateISO.slice(0, 10);
    if (!acc[dateKey]) {
      acc[dateKey] = { label: workout.date, reps: 0 };
    }
    acc[dateKey].reps += workout.sets * workout.reps;
    return acc;
  }, {});

  const sortedKeys = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));
  const labels = sortedKeys.map((key) => grouped[key].label);
  const data = sortedKeys.map((key) => grouped[key].reps);

  if (!chart) {
    chart = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total reps',
            data,
            tension: 0.35,
            borderColor: 'rgba(37, 99, 235, 0.9)',
            backgroundColor: 'rgba(37, 99, 235, 0.18)',
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: 'white',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: getComputedStyle(document.body).getPropertyValue('--text') },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148, 163, 184, 0.16)' },
            ticks: { color: getComputedStyle(document.body).getPropertyValue('--text') },
          },
        },
        plugins: {
          legend: { labels: { color: getComputedStyle(document.body).getPropertyValue('--text') } },
        },
      },
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
  }
}

// Remove a workout from the array and refresh the UI.
function deleteWorkout(workoutId) {
  workouts = workouts.filter((item) => item.id !== workoutId);
  updateUI();
}

// Edit the selected workout with a prompt for sets and reps.
function editWorkout(workoutId) {
  const workout = workouts.find((item) => item.id === workoutId);
  if (!workout) return;

  const newSets = prompt('Update sets:', workout.sets);
  const newReps = prompt('Update reps:', workout.reps);

  if (newSets === null || newReps === null) {
    return;
  }

  const setsValue = Number(newSets);
  const repsValue = Number(newReps);

  if (setsValue < 1 || repsValue < 1) {
    alert('Please enter valid numbers for sets and reps.');
    return;
  }

  workout.sets = setsValue;
  workout.reps = repsValue;
  updateUI();
}

// Alert the user on Sundays to rest.
function checkRestDay() {
  const today = new Date();
  const isSunday = today.getDay() === 0;
  if (isSunday) {
    alert('Rest Day! Take a break');
  }
}

// Save workouts array to localStorage.
function saveWorkouts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts));
  alert('Workouts saved successfully.');
}

// Load workouts from localStorage and parse them.
function loadSavedWorkouts(showAlert = true) {
  const savedData = localStorage.getItem(STORAGE_KEY);
  if (!savedData) {
    if (showAlert) {
      alert('No saved workouts found.');
    }
    return;
  }

  try {
    const parsed = JSON.parse(savedData);
    if (!Array.isArray(parsed)) {
      throw new Error('Saved data is invalid.');
    }

    workouts = parsed.map((item) => ({
      id: item.id || Date.now() + Math.random(),
      exercise: item.exercise || '',
      sets: Number(item.sets) || 0,
      reps: Number(item.reps) || 0,
      date: item.date || new Date(item.dateISO || Date.now()).toLocaleDateString(),
      dateISO: item.dateISO || new Date().toISOString(),
    }));

    if (showAlert) {
      alert('Workouts loaded successfully.');
    }
  } catch (error) {
    alert('Could not load saved workouts.');
    console.error(error);
  }
}

// Apply the selected theme and save the preference.
function updateTheme(mode) {
  const isDark = mode === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  themeToggle.textContent = isDark ? '☀️' : '🌙';
  themeToggle.setAttribute('aria-label', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
  localStorage.setItem(THEME_KEY, mode);
  if (chart) {
    chart.options.scales.x.ticks.color = getComputedStyle(document.body).getPropertyValue('--text');
    chart.options.scales.y.ticks.color = getComputedStyle(document.body).getPropertyValue('--text');
    chart.options.plugins.legend.labels.color = getComputedStyle(document.body).getPropertyValue('--text');
    chart.update();
  }
}

// Toggle between dark and light theme.
function toggleTheme() {
  const isDark = document.body.classList.contains('dark-mode');
  updateTheme(isDark ? 'light' : 'dark');
}

// Load saved theme from localStorage.
function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  updateTheme(savedTheme);
}

// Save the daily rep goal and update the goal display.
function setGoal() {
  const goalValue = Number(goalInput.value);
  if (goalValue < 1) {
    alert('Please enter a valid daily goal greater than zero.');
    goalInput.value = dailyGoal;
    return;
  }

  dailyGoal = goalValue;
  localStorage.setItem(GOAL_KEY, dailyGoal);
  updateGoalProgress();
}

// Refresh the entire UI state.
function updateUI() {
  displayWorkouts();
  updateSummary();
  updatePersonalBest();
  updateGoalProgress();
  renderChart();
}

// Compare full dates for the same calendar day.
function isSameDay(dateA, dateB) {
  return dateA.toDateString() === dateB.toDateString();
}

// Compare if two dates are in the same week.
function isSameWeek(dateA, dateB) {
  const startOfWeekA = new Date(dateA);
  startOfWeekA.setDate(startOfWeekA.getDate() - startOfWeekA.getDay());
  startOfWeekA.setHours(0, 0, 0, 0);

  const startOfWeekB = new Date(dateB);
  startOfWeekB.setDate(startOfWeekB.getDate() - startOfWeekB.getDay());
  startOfWeekB.setHours(0, 0, 0, 0);

  return startOfWeekA.getTime() === startOfWeekB.getTime();
}

// Attach button and input event listeners.
addButton.addEventListener('click', addWorkout);
saveButton.addEventListener('click', saveWorkouts);
loadButton.addEventListener('click', () => {
  loadSavedWorkouts(true);
  updateUI();
});
themeToggle.addEventListener('click', toggleTheme);
searchInput.addEventListener('input', updateUI);
dateFilterSelect.addEventListener('change', updateUI);
setGoalButton.addEventListener('click', setGoal);

// Initialize app when the page loads.
window.addEventListener('load', initApp);
