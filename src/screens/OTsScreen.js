import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Image, Dimensions, SafeAreaView, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

export default function OTsScreen({ navigation }) {
  const [ots, setOts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tecnicoNombre, setTecnicoNombre] = useState('');
  const [tecnicoFoto, setTecnicoFoto] = useState(null);

  useEffect(() => {
    fetchOTs();

    const subscription = supabase
      .channel('ordenes_trabajo_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ordenes_trabajo' },
        (payload) => {
          console.log('Cambio detectado en ordenes_trabajo:', payload.eventType);
          fetchOTs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  async function fetchOTs() {
    try {
      setLoading(true);
      const nombre = await AsyncStorage.getItem('tecnico_nombre');
      const foto = await AsyncStorage.getItem('tecnico_foto');
      if (!nombre) {
        navigation.replace('Login');
        return;
      }
      setTecnicoNombre(nombre);
      if (foto) setTecnicoFoto(foto);

      // Obtener OTs asignadas a este técnico que no estén cerradas
      const { data, error } = await supabase
        .from('ordenes_trabajo')
        .select('*')
        .ilike('tecnico_asignado', `%${nombre}%`)
        .in('estado', ['Abierta', 'En proceso'])
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setOts(data || []);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las OTs: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas salir del portal?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Salir', 
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('tecnico_nombre');
            await AsyncStorage.removeItem('tecnico_id');
            await AsyncStorage.removeItem('tecnico_foto');
            navigation.replace('Login');
          }
        }
      ]
    );
  }

  const countAbiertas = ots.filter(o => o.estado === 'Abierta').length;
  const countProceso = ots.filter(o => o.estado === 'En proceso').length;

  const renderOT = ({ item }) => {
    const isP1 = item.prioridad === 'P1 Emergencia';
    const isPreventivo = item.tipo_mantenimiento === 'Preventivo';

    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('OTDetail', { ot: item })}
      >
        {/* Glow indicator line */}
        <View style={[
          styles.cardGlowIndicator,
          isP1 ? styles.glowP1 : (isPreventivo ? styles.glowPreventivo : styles.glowDefault)
        ]} />

        <View style={styles.cardHeader}>
          <View style={styles.otBadge}>
            <Text style={styles.otNumber}>{item.numero_ot}</Text>
          </View>
          <View style={[
            styles.statusPill, 
            item.estado === 'Abierta' ? styles.statusPillAbierta : styles.statusPillProceso
          ]}>
            <Text style={[
              styles.statusText,
              item.estado === 'Abierta' ? { color: '#ef4444' } : { color: '#f59e0b' }
            ]}>
              {item.estado}
            </Text>
          </View>
        </View>

        <Text style={styles.cardTag}>⚙️ {item.activo_tag}</Text>
        
        <View style={styles.cardMetaRow}>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText}>{item.tipo_mantenimiento}</Text>
          </View>
          <View style={[
            styles.metaBadge, 
            isP1 ? styles.priorityP1Badge : styles.priorityNormalBadge
          ]}>
            <Text style={[
              styles.metaBadgeText,
              isP1 ? { color: '#ef4444' } : { color: '#64748b' }
            ]}>
              {item.prioridad}
            </Text>
          </View>
        </View>

        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.descripcion_problema?.replace(/Checklist:[\s\S]*/g, '').trim() || 'Sin descripción adicional'}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={styles.cardDate}>📅 {new Date(item.created_at).toLocaleDateString()}</Text>
          <Text style={styles.viewMoreText}>Gestionar OT →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1d" />
      
      {/* Background blobs to simulate futuristic neon blur lights */}
      <View style={[styles.blurBlob, styles.blobPurple]} />
      <View style={[styles.blurBlob, styles.blobBlue]} />

      {/* Header Premium */}
      <View style={styles.header}>
        <View style={styles.profileContainer}>
          <View style={styles.imageRing}>
            {tecnicoFoto ? (
              <Image source={{ uri: tecnicoFoto }} style={styles.profileImage} />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profileInitial}>
                  {tecnicoNombre ? tecnicoNombre.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.welcomeText}>Panel Técnico</Text>
            <Text style={styles.greeting} numberOfLines={1}>{tecnicoNombre}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.8}>
          <Text style={styles.logoutIcon}>🚪</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Panel */}
      <View style={styles.statsPanel}>
        <View style={[styles.statBox, styles.statBoxAbierta]}>
          <Text style={styles.statCount}>{countAbiertas}</Text>
          <Text style={styles.statLabel}>Abiertas</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxProceso]}>
          <Text style={styles.statCount}>{countProceso}</Text>
          <Text style={styles.statLabel}>En Proceso</Text>
        </View>
        <View style={[styles.statBox, styles.statBoxTotal]}>
          <Text style={styles.statCount}>{ots.length}</Text>
          <Text style={styles.statLabel}>Mis OTs</Text>
        </View>
      </View>

      <Text style={styles.title}>Órdenes de Trabajo Activas</Text>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#00bfff" />
          <Text style={styles.loaderText}>Sincronizando órdenes...</Text>
        </View>
      ) : ots.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🎉</Text>
          <Text style={styles.emptyTitle}>¡Todo al día!</Text>
          <Text style={styles.emptyText}>No tienes órdenes de trabajo pendientes.</Text>
        </View>
      ) : (
        <FlatList
          data={ots}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderOT}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={fetchOTs}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1d', // Ultra deep futuristic navy
  },
  blurBlob: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.12,
  },
  blobPurple: {
    backgroundColor: '#8a2be2',
    top: '-5%',
    right: '-10%',
  },
  blobBlue: {
    backgroundColor: '#00bfff',
    bottom: '20%',
    left: '-15%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 15 : 20,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  imageRing: {
    padding: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: '#00bfff',
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  profilePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  welcomeText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  greeting: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 1,
  },
  logoutBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutIcon: {
    fontSize: 18,
    color: '#ef4444',
  },
  statsPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  statBoxAbierta: {
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  statBoxProceso: {
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  statBoxTotal: {
    borderLeftWidth: 3,
    borderLeftColor: '#00bfff',
  },
  statCount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 10,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 18,
    marginBottom: 15,
    overflow: 'hidden',
    position: 'relative',
  },
  cardGlowIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  glowP1: {
    backgroundColor: '#ef4444',
  },
  glowPreventivo: {
    backgroundColor: '#10b981',
  },
  glowDefault: {
    backgroundColor: '#3b82f6',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  otBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  otNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00bfff',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillAbierta: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  statusPillProceso: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  cardTag: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  cardMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metaBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  metaBadgeText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  priorityP1Badge: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  priorityNormalBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  cardDescription: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 10,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  cardDate: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  viewMoreText: {
    fontSize: 13,
    color: '#00bfff',
    fontWeight: '700',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: '#94a3b8',
    marginTop: 10,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
