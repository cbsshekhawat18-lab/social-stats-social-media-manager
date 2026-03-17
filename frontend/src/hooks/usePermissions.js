import { useState, useCallback } from 'react';
import { managementAPI } from '../services/api';

export function useStaffList() {
  const [staff, setStaff]     = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await managementAPI.listStaff();
      setStaff(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  return { staff, loading, fetchStaff, setStaff };
}

export function useClientManagementList() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await managementAPI.listClients();
      setClients(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  return { clients, loading, fetchClients, setClients };
}

export function usePermissionGroups() {
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await managementAPI.listPermissions();
      setGroups(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  return { groups, loading, fetchGroups };
}
