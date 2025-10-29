export function initializeDashboard(supabase, user) {
  const dashboardContent = document.getElementById('dashboard-content');
  
  dashboardContent.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- Stats Cards -->
      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <h3 class="text-lg font-semibold text-gray-800 mb-2">Total Tasks</h3>
        <p class="text-3xl font-bold text-blue-600" id="total-tasks">0</p>
      </div>
      
      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <h3 class="text-lg font-semibold text-gray-800 mb-2">Completed</h3>
        <p class="text-3xl font-bold text-green-600" id="completed-tasks">0</p>
      </div>
      
      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <h3 class="text-lg font-semibold text-gray-800 mb-2">In Progress</h3>
        <p class="text-3xl font-bold text-yellow-600" id="inprogress-tasks">0</p>
      </div>
    </div>

    <div class="mt-8 bg-white rounded-lg shadow-sm border p-6">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
      <div class="flex gap-4">
        <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">
          Add New Task
        </button>
        <button class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors">
          View Reports
        </button>
        <button class="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors">
          Settings
        </button>
      </div>
    </div>

    <div class="mt-8 bg-white rounded-lg shadow-sm border p-6">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">Recent Activity</h2>
      <p class="text-gray-500">Your activity will appear here...</p>
    </div>
  `;

  // Load user data
  loadUserData(supabase, user);
}

async function loadUserData(supabase, user) {
  try {
    console.log('Loading data for user:', user.id);
    
    // Here you can load user-specific data from Supabase
    // For now, we'll just display placeholder data
    
    document.getElementById('total-tasks').textContent = '12';
    document.getElementById('completed-tasks').textContent = '8';
    document.getElementById('inprogress-tasks').textContent = '4';
    
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}