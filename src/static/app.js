document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const authStatus = document.getElementById("auth-status");
  const userMenuBtn = document.getElementById("user-menu-btn");
  const loginModal = document.getElementById("login-modal");
  const closeLoginModalBtn = document.getElementById("close-login-modal");
  const loginForm = document.getElementById("login-form");

  let authToken = localStorage.getItem("adminAuthToken");
  let authenticatedUsername = null;

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function setAuthUiState(authenticated) {
    authStatus.textContent = authenticated
      ? `Teacher mode: ${authenticatedUsername}`
      : "Student mode";
    loginBtn.classList.toggle("hidden", authenticated);
    logoutBtn.classList.toggle("hidden", !authenticated);

    const formElements = signupForm.querySelectorAll("input, select, button");
    formElements.forEach((element) => {
      element.disabled = !authenticated;
    });

    let loginNote = document.getElementById("login-required-note");
    if (!authenticated && !loginNote) {
      loginNote = document.createElement("p");
      loginNote.id = "login-required-note";
      loginNote.className = "login-required-note";
      loginNote.textContent =
        "Only teachers can register or unregister students. Please log in.";
      signupForm.appendChild(loginNote);
    }

    if (authenticated && loginNote) {
      loginNote.remove();
    }
  }

  async function refreshAuthStatus() {
    if (!authToken) {
      authenticatedUsername = null;
      setAuthUiState(false);
      return;
    }

    try {
      const response = await fetch("/auth/status", {
        headers: {
          "X-Auth-Token": authToken,
        },
      });
      const result = await response.json();

      if (result.authenticated) {
        authenticatedUsername = result.username;
        setAuthUiState(true);
      } else {
        authToken = null;
        authenticatedUsername = null;
        localStorage.removeItem("adminAuthToken");
        setAuthUiState(false);
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      authenticatedUsername = null;
      setAuthUiState(false);
    }
  }

  function openLoginModal() {
    loginModal.classList.remove("hidden");
  }

  function closeLoginModal() {
    loginModal.classList.add("hidden");
    loginForm.reset();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      const isTeacherMode = Boolean(authToken && authenticatedUsername);

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        isTeacherMode
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "X-Auth-Token": authToken || "",
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            "X-Auth-Token": authToken || "",
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginBtn.addEventListener("click", openLoginModal);
  userMenuBtn.addEventListener("click", openLoginModal);
  closeLoginModalBtn.addEventListener("click", closeLoginModal);

  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) {
      closeLoginModal();
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      authToken = result.token;
      authenticatedUsername = result.username;
      localStorage.setItem("adminAuthToken", authToken);
      setAuthUiState(true);
      closeLoginModal();
      showMessage(result.message, "success");
      fetchActivities();
    } catch (error) {
      showMessage("Login request failed. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      if (authToken) {
        await fetch("/auth/logout", {
          method: "POST",
          headers: {
            "X-Auth-Token": authToken,
          },
        });
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }

    authToken = null;
    authenticatedUsername = null;
    localStorage.removeItem("adminAuthToken");
    setAuthUiState(false);
    showMessage("Logged out", "info");
    fetchActivities();
  });

  // Initialize app
  refreshAuthStatus().then(fetchActivities);
});
