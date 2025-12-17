"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Department {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export default function DepartmentsPage() {
  const { data: session } = useSession();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newDeptName, setNewDeptName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      fetchDepartments();
    }
  }, [session]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (err) {
      console.error("Failed to fetch departments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;

    setIsAdding(true);
    setError(null);

    try {
      const response = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDeptName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments((prev) => [...prev, data.department]);
        setNewDeptName("");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to add department");
      }
    } catch (err) {
      console.error("Failed to add department:", err);
      setError("Failed to add department");
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (dept: Department) => {
    setEditingId(dept.id);
    setEditingName(dept.name);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) return;

    setError(null);

    try {
      const response = await fetch(`/api/departments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments((prev) =>
          prev.map((d) => (d.id === id ? data.department : d))
        );
        setEditingId(null);
        setEditingName("");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update department");
      }
    } catch (err) {
      console.error("Failed to update department:", err);
      setError("Failed to update department");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    setError(null);

    try {
      const response = await fetch(`/api/departments/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDepartments((prev) => prev.filter((d) => d.id !== id));
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete department");
      }
    } catch (err) {
      console.error("Failed to delete department:", err);
      setError("Failed to delete department");
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    await swapSortOrder(index, index - 1);
  };

  const handleMoveDown = async (index: number) => {
    if (index === departments.length - 1) return;
    await swapSortOrder(index, index + 1);
  };

  const swapSortOrder = async (indexA: number, indexB: number) => {
    const deptA = departments[indexA];
    const deptB = departments[indexB];

    // Optimistically update UI
    const newDepts = [...departments];
    newDepts[indexA] = { ...deptB, sort_order: deptA.sort_order };
    newDepts[indexB] = { ...deptA, sort_order: deptB.sort_order };
    setDepartments(newDepts);

    // Update in database
    try {
      await Promise.all([
        fetch(`/api/departments/${deptA.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: deptB.sort_order }),
        }),
        fetch(`/api/departments/${deptB.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: deptA.sort_order }),
        }),
      ]);
    } catch (err) {
      console.error("Failed to reorder departments:", err);
      // Revert on error
      fetchDepartments();
    }
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to manage departments.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
        <p className="text-gray-600 mt-1">
          Manage grocery store departments for organizing ingredients.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Add new department form */}
      <form onSubmit={handleAddDepartment} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            placeholder="New department name..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isAdding || !newDeptName.trim()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {isAdding ? "Adding..." : "Add"}
          </button>
        </div>
      </form>

      {/* Departments list */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {departments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg
              className="w-12 h-12 mx-auto text-gray-300 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <p>No departments yet.</p>
            <p className="text-sm mt-1">Add your first department above.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {departments.map((dept, index) => (
              <li
                key={dept.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                {editingId === dept.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(dept.id);
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                    />
                    <button
                      onClick={() => handleSaveEdit(dept.id)}
                      className="px-3 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      {/* Reorder buttons */}
                      <div className="flex flex-col">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                          title="Move up"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === departments.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                          title="Move down"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                      </div>
                      <span className="font-medium text-gray-900">
                        {dept.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartEdit(dept)}
                        className="p-2 text-gray-400 hover:text-emerald-600 transition-colors"
                        title="Edit"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(dept.id, dept.name)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-sm text-gray-500">
        Departments help organize ingredients by store section, making grocery shopping more efficient.
      </p>
    </div>
  );
}
