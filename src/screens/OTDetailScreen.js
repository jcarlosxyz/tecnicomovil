import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Dimensions, SafeAreaView, StatusBar } from 'react-native';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

export default function OTDetailScreen({ route, navigation }) {
  const { ot } = route.params;

  // Form State
  const [selectedEstado, setSelectedEstado] = useState(ot.estado);
  const [trabajoRealizado, setTrabajoRealizado] = useState(ot.trabajo_realizado || '');
  const [causaRaiz, setCausaRaiz] = useState(ot.causa_raiz || '');
  const [tiempoReparacion, setTiempoReparacion] = useState(ot.tiempo_reparacion_horas || 0);
  const [firmaCierre, setFirmaCierre] = useState(ot.firma_cierre || '');
  const [fechaCierre, setFechaCierre] = useState(ot.fecha_cierre || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Materials State
  const [registrosMateriales, setRegistrosMateriales] = useState([]);
  const [loadingMateriales, setLoadingMateriales] = useState(true);
  const [inventario, setInventario] = useState([]);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [cantidadMaterial, setCantidadMaterial] = useState('1');
  const [notasMaterial, setNotasMaterial] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Parse PM Checklist
  const rawDesc = ot.descripcion_problema || '';
  const isPreventivo = ot.tipo_mantenimiento === 'Preventivo';
  
  // Extract Clean Title of PM
  const pmTitleMatch = rawDesc.match(/^Plan de Mantenimiento(?:\s+Preventivo)?:\s*(.+?)(?:\n|$)/i);
  const cleanTitle = pmTitleMatch ? pmTitleMatch[1].trim() : rawDesc.split('\n')[0];

  // Parse checklist items (supporting both [ ] and [x])
  const initialTasks = rawDesc
    .split('\n')
    .filter(line => line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]') || line.trim().startsWith('- [X]'))
    .map((line, idx) => {
      const isChecked = line.trim().startsWith('- [x]') || line.trim().startsWith('- [X]');
      return {
        id: idx,
        text: line.replace(/^-\s*\[\s*[xX ]\s*\]\s*/, '').trim(),
        checked: isChecked
      };
    });

  const [tasks, setTasks] = useState(initialTasks);

  // Load consumed materials and available materials in inventory
  const fetchMateriales = async () => {
    try {
      setLoadingMateriales(true);
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.40:3000/api';
      
      let localRegistros = [];
      try {
        // Intento 1: REST API
        const res = await fetch(`${apiUrl}/ordenes-materiales?orden_id=${ot.id}`);
        if (res.ok) {
          const json = await res.json();
          localRegistros = json.data || json;
        }
      } catch (e) {
        console.warn('Fallo REST al listar consumo, usando Supabase:', e);
      }

      if (localRegistros.length === 0) {
        // Intento 2: Supabase direct query
        const { data, error } = await supabase
          .from('ordenes_materiales')
          .select('*, materiales(nombre, unidad)')
          .eq('orden_id', ot.id);
        
        if (!error && data) {
          localRegistros = data;
        }
      }
      setRegistrosMateriales(localRegistros);

      // Cargar inventario de materiales
      let localInventario = [];
      try {
        const res = await fetch(`${apiUrl}/materiales?limite=200`);
        if (res.ok) {
          const json = await res.json();
          localInventario = json.data || json;
        }
      } catch (e) {
        console.warn('Fallo REST al listar inventario, usando Supabase:', e);
      }

      if (localInventario.length === 0) {
        const { data, error } = await supabase
          .from('materiales')
          .select('*')
          .order('nombre');
        if (!error && data) {
          localInventario = data;
        }
      }
      setInventario(localInventario);
    } catch (err) {
      console.error('Error al cargar materiales:', err);
    } finally {
      setLoadingMateriales(false);
    }
  };

  useEffect(() => {
    fetchMateriales();
  }, [ot.id]);

  // Toggle local checklist item
  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, checked: !t.checked } : t));
  };

  // Calculates hours between two dates
  const calcularHoras = (inicio, fin) => {
    const diff = new Date(fin).getTime() - new Date(inicio).getTime();
    return Math.max(0, Math.round((diff / 3600000) * 100) / 100);
  };

  // Handle segment status selection change
  const handleEstadoChange = (nuevoEstado) => {
    setSelectedEstado(nuevoEstado);
    if (nuevoEstado === 'Cerrada') {
      const ahora = new Date().toISOString();
      const horas = calcularHoras(ot.created_at, ahora);
      setTiempoReparacion(horas);
      setFechaCierre(ahora);
    } else {
      setTiempoReparacion(0);
      setFechaCierre('');
    }
  };

  // Handle Registering a consumed material
  const handleAddMaterialSubmit = async () => {
    if (!selectedMaterialId) {
      Alert.alert('Datos incompletos', 'Por favor selecciona un material de la lista.');
      return;
    }
    const qty = parseFloat(cantidadMaterial);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Cantidad inválida', 'La cantidad debe ser mayor a 0.');
      return;
    }

    const selectedMat = inventario.find(m => m.id === selectedMaterialId);
    if (selectedMat && qty > selectedMat.stock) {
      Alert.alert('Stock Insuficiente', `Solo hay ${selectedMat.stock} ${selectedMat.unidad} disponibles.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.40:3000/api';
      const payload = {
        orden_id: ot.id,
        material_id: selectedMaterialId,
        cantidad: qty,
        notas: notasMaterial || undefined,
        fecha_instalacion: new Date().toISOString()
      };

      let success = false;
      try {
        const response = await fetch(`${apiUrl}/ordenes-materiales`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          success = true;
        }
      } catch (err) {
        console.warn('Fallo REST al registrar material, usando Supabase:', err);
      }

      if (!success) {
        // Fallback Supabase
        const { data: currentMaterial, error: errFetch } = await supabase
          .from('materiales')
          .select('stock, costo_unitario')
          .eq('id', selectedMaterialId)
          .single();

        if (errFetch || !currentMaterial) throw new Error('No se pudo verificar el stock del material.');

        if (qty > currentMaterial.stock) {
          Alert.alert('Stock Insuficiente', `Solo hay ${currentMaterial.stock} unidades disponibles.`);
          return;
        }

        const { error: errInsert } = await supabase
          .from('ordenes_materiales')
          .insert({
            orden_id: ot.id,
            material_id: selectedMaterialId,
            cantidad: qty,
            costo_unitario_aplicado: currentMaterial.costo_unitario,
            notas: notasMaterial || null,
            fecha_instalacion: new Date().toISOString()
          });

        if (errInsert) throw new Error(errInsert.message);

        // Decrement stock in fallback
        await supabase
          .from('materiales')
          .update({ stock: currentMaterial.stock - qty })
          .eq('id', selectedMaterialId);
      }

      Alert.alert('¡Registrado!', 'Material cargado exitosamente a la orden.');
      setShowAddMaterial(false);
      setSelectedMaterialId('');
      setCantidadMaterial('1');
      setNotasMaterial('');
      fetchMateriales();
    } catch (err) {
      Alert.alert('Error', 'No se pudo registrar el material: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Deleting a consumed material
  const handleDeleteMaterial = async (id, nombreMat) => {
    Alert.alert(
      'Devolver Material',
      `¿Deseas devolver el stock y eliminar el consumo de "${nombreMat}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar Consumo',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsSubmitting(true);
              const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.40:3000/api';
              
              let success = false;
              try {
                const response = await fetch(`${apiUrl}/ordenes-materiales/${id}`, {
                  method: 'DELETE'
                });
                if (response.ok) {
                  success = true;
                }
              } catch (err) {
                console.warn('Fallo REST al eliminar material, usando Supabase:', err);
              }

              if (!success) {
                // Fallback Supabase direct delete and stock return
                const { data: consumo, error: errConsumo } = await supabase
                  .from('ordenes_materiales')
                  .select('*')
                  .eq('id', id)
                  .single();

                if (!errConsumo && consumo) {
                  const { error: errDel } = await supabase
                    .from('ordenes_materiales')
                    .delete()
                    .eq('id', id);

                  if (errDel) throw new Error(errDel.message);

                  // Return stock to inventory in fallback
                  const { data: mat } = await supabase
                    .from('materiales')
                    .select('stock')
                    .eq('id', consumo.material_id)
                    .single();

                  if (mat) {
                    await supabase
                      .from('materiales')
                      .update({ stock: mat.stock + consumo.cantidad })
                      .eq('id', consumo.material_id);
                  }
                }
              }

              Alert.alert('Material Retornado', 'El consumo ha sido borrado e inventariado de vuelta.');
              fetchMateriales();
            } catch (err) {
              Alert.alert('Error', 'No se pudo eliminar el material: ' + err.message);
            } finally {
              setIsSubmitting(false);
            }
          }
        }
      ]
    );
  };

  // Submit Closure / Save changes
  async function handleCerrarOT() {
    if (selectedEstado === 'Cerrada') {
      if (!trabajoRealizado.trim()) {
        Alert.alert('Datos obligatorios', 'Debes describir el Trabajo Realizado para cerrar la OT.');
        return;
      }
      if (!firmaCierre.trim()) {
        Alert.alert('Datos obligatorios', 'La Firma de supervisor/validación es obligatoria para cerrar la OT.');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.40:3000/api';
      
      // Rebuild the description with updated checklist state if Preventivo
      let updatedDesc = rawDesc;
      if (isPreventivo) {
        const lines = rawDesc.split('\n');
        let taskIdx = 0;
        const newLines = lines.map(line => {
          if (line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]') || line.trim().startsWith('- [X]')) {
            const task = tasks[taskIdx++];
            if (task) {
              return `- [${task.checked ? 'x' : ' '}] ${task.text}`;
            }
          }
          return line;
        });
        updatedDesc = newLines.join('\n');
      }

      const payload = {
        estado: selectedEstado,
        trabajo_realizado: trabajoRealizado,
        causa_raiz: causaRaiz,
        tiempo_reparacion_horas: parseFloat(tiempoReparacion) || 0,
        firma_cierre: firmaCierre,
        descripcion_problema: updatedDesc
      };
      
      if (selectedEstado === 'Cerrada') {
        payload.fecha_cierre = fechaCierre || new Date().toISOString();
      }

      let backendSuccess = false;
      try {
        // Intento 1: A través del API de Node.js
        const response = await fetch(`${apiUrl}/ordenes/${ot.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          backendSuccess = true;
        }
      } catch (networkError) {
        console.warn('No se pudo contactar al API local, usando actualización directa a Supabase:', networkError);
      }

      if (!backendSuccess) {
        // Intento 2 (Fallback): Actualización directa a la base de datos Supabase
        if (selectedEstado === 'Cerrada') {
          payload.fecha_cierre = payload.fecha_cierre || new Date().toISOString();
        }

        const { error: supaError } = await supabase
          .from('ordenes_trabajo')
          .update(payload)
          .eq('id', ot.id);

        if (supaError) throw new Error('Error al guardar en base de datos: ' + supaError.message);
        
        // También actualizamos el estado del activo en el fallback
        if (ot.activo_tag) {
          let nuevoEstadoActivo = 'En mantenimiento';
          if (selectedEstado === 'Cerrada') {
            nuevoEstadoActivo = 'Operativo';
          } else if (ot.tipo_mantenimiento === 'Correctivo') {
            nuevoEstadoActivo = 'Fuera de servicio';
          }
          await supabase.from('activos').update({ estado: nuevoEstadoActivo }).eq('tag', ot.activo_tag);
        }
      }

      Alert.alert('¡Guardado!', 'La orden de trabajo ha sido actualizada correctamente.', [
        { text: 'Entendido', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      Alert.alert('Error', 'No se pudieron guardar los cambios: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1d" />
      
      {/* Background blobs to simulate futuristic neon blur lights */}
      <View style={[styles.blurBlob, styles.blobPurple]} />
      <View style={[styles.blurBlob, styles.blobBlue]} />

      {/* Header Premium */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalles de OT</Text>
        <View style={{ width: 75 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Ficha General de la OT */}
        <View style={styles.card}>
          <View style={styles.topRow}>
            <Text style={styles.otNumber}>{ot.numero_ot}</Text>
            <View style={[
              styles.statusBadge, 
              ot.estado === 'Abierta' ? styles.statusAbierta : 
              ot.estado === 'En proceso' ? styles.statusProceso : 
              ot.estado === 'En espera' ? styles.statusEspera : styles.statusCerrada
            ]}>
              <Text style={[
                styles.statusText,
                ot.estado === 'Abierta' ? { color: '#ef4444' } : 
                ot.estado === 'En proceso' ? { color: '#f59e0b' } : 
                ot.estado === 'En espera' ? { color: '#eab308' } : { color: '#10b981' }
              ]}>{ot.estado}</Text>
            </View>
          </View>
          
          <Text style={styles.label}>Activo Vinculado (TAG)</Text>
          <Text style={styles.valueHighlight}>{ot.activo_tag}</Text>

          <View style={styles.divider} />

          {/* Información del problema o Plan Preventivo */}
          {isPreventivo ? (
            <View>
              <Text style={styles.label}>Plan de Mantenimiento Preventivo</Text>
              <View style={styles.pmHeader}>
                <View style={styles.pmBadge}>
                  <Text style={styles.pmBadgeText}>PM · PREVENTIVO</Text>
                </View>
                <Text style={styles.pmTitle}>{cleanTitle}</Text>
              </View>

              {/* checklist interactivo */}
              {tasks.length > 0 && (
                <View style={styles.checklistContainer}>
                  <View style={styles.checklistHeader}>
                    <Text style={styles.checklistHeaderText}>📋 TAREAS DEL COMPONENTE — {tasks.length}</Text>
                  </View>
                  {tasks.map((task) => (
                    <TouchableOpacity 
                      key={task.id} 
                      style={styles.taskItem}
                      onPress={() => toggleTask(task.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, task.checked && styles.checkboxChecked]}>
                        {task.checked && <Text style={styles.checkIcon}>✓</Text>}
                      </View>
                      <Text style={[styles.taskText, task.checked && styles.taskTextChecked]}>
                        {task.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View>
              <Text style={styles.label}>Descripción del Reporte</Text>
              <Text style={styles.description}>{ot.descripcion_problema}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>Prioridad</Text>
              <Text style={styles.value}>{ot.prioridad}</Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Tipo de Mantenimiento</Text>
              <Text style={styles.value}>{ot.tipo_mantenimiento}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.label}>Fecha de Emisión</Text>
          <Text style={styles.value}>{new Date(ot.created_at).toLocaleString()}</Text>
          
          {ot.fecha_limite_inicio ? (
            <>
              <Text style={[styles.label, { marginTop: 15 }]}>Fecha Límite Establecida</Text>
              <Text style={[styles.value, { color: '#ef4444', fontWeight: 'bold' }]}>
                {new Date(ot.fecha_limite_inicio).toLocaleString()}
              </Text>
            </>
          ) : null}
        </View>

        {/* Ficha de Materiales y Refacciones */}
        <View style={styles.card}>
          <View style={styles.materialsHeader}>
            <Text style={styles.cardSectionTitle}>📦 Consumo de Materiales</Text>
            {registrosMateriales.length > 0 && (
              <View style={styles.costBadge}>
                <Text style={styles.costBadgeText}>
                  Total: ${registrosMateriales.reduce((acc, r) => acc + (r.costo_unitario_aplicado || 0) * r.cantidad, 0).toFixed(2)}
                </Text>
              </View>
            )}
          </View>

          {/* Botón de Agregar (Solo si la OT no está cerrada) */}
          {ot.estado !== 'Cerrada' && !showAddMaterial && (
            <TouchableOpacity 
              style={styles.btnAddMaterial}
              onPress={() => setShowAddMaterial(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.btnAddMaterialText}>+ Registrar Repuesto o Insumo</Text>
            </TouchableOpacity>
          )}

          {/* Formulario inline de Añadir Material */}
          {showAddMaterial && (
            <View style={styles.materialForm}>
              <Text style={styles.materialFormTitle}>Registrar Consumo</Text>

              {/* Selector de material */}
              <Text style={styles.formLabel}>Material / Refacción *</Text>
              <TouchableOpacity 
                style={styles.materialSelectBtn}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.materialSelectBtnText}>
                  {selectedMaterialId ? (
                    (() => {
                      const selected = inventario.find(m => m.id === selectedMaterialId);
                      return selected ? `📦 ${selected.nombre} (${selected.stock} ${selected.unidad} disp.)` : 'Seleccionar...'
                    })()
                  ) : 'Toca para buscar material...'}
                </Text>
              </TouchableOpacity>

              {/* Cantidad */}
              <Text style={[styles.formLabel, { marginTop: 14 }]}>Cantidad a Usar *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Ej. 2"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                value={cantidadMaterial}
                onChangeText={setCantidadMaterial}
              />

              {/* Notas */}
              <Text style={[styles.formLabel, { marginTop: 14 }]}>Notas de Instalación</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={2}
                placeholder="Indica la ubicación física o notas..."
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                value={notasMaterial}
                onChangeText={setNotasMaterial}
              />

              {/* Acciones del formulario */}
              <View style={styles.formRowActions}>
                <TouchableOpacity 
                  style={[styles.formActionBtn, styles.btnCancelMat]}
                  onPress={() => {
                    setShowAddMaterial(false);
                    setSelectedMaterialId('');
                    setCantidadMaterial('1');
                    setNotasMaterial('');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnCancelMatText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.formActionBtn, styles.btnSaveMat]}
                  onPress={handleAddMaterialSubmit}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnSaveMatText}>Registrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Listado de Materiales Registrados */}
          {loadingMateriales ? (
            <ActivityIndicator style={{ marginVertical: 15 }} color="#00bfff" />
          ) : registrosMateriales.length === 0 ? (
            <View style={styles.emptyMaterials}>
              <Text style={styles.emptyMaterialsText}>No se han cargado refacciones a esta OT.</Text>
            </View>
          ) : (
            <View style={styles.materialsList}>
              {registrosMateriales.map((reg) => (
                <View key={reg.id} style={styles.materialItem}>
                  <View style={styles.materialItemHeader}>
                    <Text style={styles.materialItemName}>
                      📦 {reg.materiales?.nombre || 'Material'}
                    </Text>
                    
                    {/* Botón Eliminar consumo (Solo si la OT no está cerrada) */}
                    {ot.estado !== 'Cerrada' && (
                      <TouchableOpacity 
                        style={styles.btnDeleteMat}
                        onPress={() => handleDeleteMaterial(reg.id, reg.materiales?.nombre || 'material')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.btnDeleteMatText}>🗑️</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.materialItemMeta}>
                    <View style={styles.qtyBadge}>
                      <Text style={styles.qtyBadgeText}>
                        {reg.cantidad} {reg.materiales?.unidad || ''}
                      </Text>
                    </View>
                    <View style={styles.costItemBadge}>
                      <Text style={styles.costItemBadgeText}>
                        ${((reg.costo_unitario_aplicado || 0) * reg.cantidad).toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {reg.notes || reg.notas ? (
                    <View style={styles.materialItemNotes}>
                      <Text style={styles.materialItemNotesText}>📝 NOTA: {reg.notes || reg.notas}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Formulario / Detalle de Cierre (Modo Lectura si ya está Cerrada) */}
        {ot.estado === 'Cerrada' ? (
          <View style={styles.cardReadonly}>
            <Text style={styles.readonlyTitle}>🔒 ORDEN DE TRABAJO CERRADA</Text>
            <View style={styles.divider} />
            
            <Text style={styles.label}>Trabajo Realizado</Text>
            <Text style={styles.valueReadonly}>{ot.trabajo_realizado}</Text>

            {ot.tipo_mantenimiento === 'Correctivo' && ot.causa_raiz ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.label}>Causa Raíz Identificada</Text>
                <Text style={[styles.valueReadonly, { color: '#f59e0b' }]}>{ot.causa_raiz}</Text>
              </>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.column}>
                <Text style={styles.label}>Tiempo Neto de Ejecución</Text>
                <Text style={styles.valueHighlight}>{ot.tiempo_reparacion_horas || '0'} Horas</Text>
              </View>
              <View style={styles.column}>
                <Text style={styles.label}>Validado/Firma Por</Text>
                <Text style={styles.value}>{ot.firma_cierre}</Text>
              </View>
            </View>
            
            <View style={styles.divider} />
            <Text style={styles.label}>Fecha Oficial de Cierre</Text>
            <Text style={styles.value}>{ot.fecha_cierre ? new Date(ot.fecha_cierre).toLocaleString() : 'No registrada'}</Text>
          </View>
        ) : (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Actualizar Estatus / Progreso</Text>

            {/* Selector de Estado Horizontal */}
            <Text style={styles.formLabel}>Estatus de la OT</Text>
            <View style={styles.selectorContainer}>
              {['Abierta', 'En proceso', 'En espera', 'Cerrada'].map((est) => {
                const isSelected = selectedEstado === est;
                let activeStyle = {};
                let textActiveColor = '#94a3b8';
                let icon = '⭕';

                if (est === 'Abierta') {
                  activeStyle = styles.selectedAbierta;
                  textActiveColor = isSelected ? '#ef4444' : '#94a3b8';
                  icon = '🔓';
                } else if (est === 'En proceso') {
                  activeStyle = styles.selectedProceso;
                  textActiveColor = isSelected ? '#f59e0b' : '#94a3b8';
                  icon = '🔧';
                } else if (est === 'En espera') {
                  activeStyle = styles.selectedEspera;
                  textActiveColor = isSelected ? '#eab308' : '#94a3b8';
                  icon = '⏳';
                } else if (est === 'Cerrada') {
                  activeStyle = styles.selectedCerrada;
                  textActiveColor = isSelected ? '#10b981' : '#94a3b8';
                  icon = '✅';
                }

                return (
                  <TouchableOpacity
                    key={est}
                    style={[
                      styles.selectorButton,
                      isSelected ? activeStyle : styles.inactiveButton
                    ]}
                    onPress={() => handleEstadoChange(est)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.selectorIcon}>{icon}</Text>
                    <Text style={[styles.selectorButtonText, { color: textActiveColor, fontWeight: isSelected ? '700' : '500' }]}>
                      {est}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tiempo de reparación autocalculado al marcar como Cerrada */}
            <View style={styles.formGroup}>
              <View style={styles.timeLabelRow}>
                <Text style={styles.formLabel}>Tiempo Estimado de Reparación (Horas)</Text>
                {selectedEstado === 'Cerrada' && (
                  <View style={styles.calculatedBadge}>
                    <Text style={styles.calculatedBadgeText}>⏱ AUTO-CALCULADO</Text>
                  </View>
                )}
              </View>
              
              <TextInput
                style={[
                  styles.input, 
                  styles.inputReadonly,
                  selectedEstado === 'Cerrada' && { color: '#10b981', fontWeight: 'bold', borderColor: '#10b981' }
                ]}
                editable={false}
                value={`${tiempoReparacion}`}
              />

              {selectedEstado === 'Cerrada' && (
                <View style={styles.timeBreakdownCard}>
                  <Text style={styles.timeBreakdownLine}>
                    📅 <Text style={styles.boldText}>Apertura:</Text> {new Date(ot.created_at).toLocaleString()}
                  </Text>
                  <Text style={styles.timeBreakdownLine}>
                    🔒 <Text style={styles.boldText}>Cierre:</Text> {new Date(fechaCierre).toLocaleString()}
                  </Text>
                  <View style={styles.timeBreakdownTotal}>
                    <Text style={styles.timeTotalText}>⏱ {tiempoReparacion} hrs transcurridas</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Trabajo Realizado */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Descripción del Trabajo Realizado {selectedEstado === 'Cerrada' && '*'}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={4}
                placeholder="Indica qué acciones preventivas/correctivas realizaste..."
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                value={trabajoRealizado}
                onChangeText={setTrabajoRealizado}
              />
            </View>

            {/* Causa Raíz */}
            {ot.tipo_mantenimiento === 'Correctivo' && (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: '#f59e0b' }]}>Causa Raíz Identificada</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { borderColor: 'rgba(245, 158, 11, 0.3)' }]}
                  multiline
                  numberOfLines={3}
                  placeholder="Detalla el motivo principal de la falla del componente..."
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  value={causaRaiz}
                  onChangeText={setCausaRaiz}
                />
              </View>
            )}

            {/* Firma Supervisor */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Nombre de Firma / Validación {selectedEstado === 'Cerrada' && '*'}</Text>
              <TextInput
                style={styles.input}
                placeholder="Supervisor o Técnico de Guardia"
                placeholderTextColor="rgba(255, 255, 255, 0.3)"
                value={firmaCierre}
                onChangeText={setFirmaCierre}
              />
            </View>

            {/* Botones de acción */}
            <View style={styles.formActions}>
              <TouchableOpacity 
                style={[
                  styles.btnSubmit,
                  selectedEstado === 'Cerrada' ? styles.btnSubmitCierre : styles.btnSubmitProgreso
                ]} 
                onPress={handleCerrarOT}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#0a0f1d" />
                ) : (
                  <Text style={styles.btnSubmitText}>
                    {selectedEstado === 'Cerrada' ? 'Confirmar Cierre de OT' : 'Guardar Cambios de Progreso'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Picker Modal Overlay */}
      {showPicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Seleccionar Material / Refacción</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar en el inventario por nombre..."
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            
            <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
              {inventario
                .filter(m => m.nombre.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={styles.pickerItem}
                    disabled={m.stock <= 0}
                    onPress={() => {
                      setSelectedMaterialId(m.id);
                      setShowPicker(false);
                      setSearchQuery('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerItemText, m.stock <= 0 && { color: 'rgba(255,255,255,0.2)' }]}>
                      {m.nombre}
                    </Text>
                    <Text style={[styles.pickerItemSub, m.stock <= 0 && { color: '#ef4444' }]}>
                      Costo: ${m.costo_unitario.toFixed(2)} — {m.stock} {m.unidad} disp. {m.stock <= 0 ? '⚠️ SIN EXISTENCIAS' : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <TouchableOpacity 
              style={styles.closePickerBtn}
              onPress={() => {
                setShowPicker(false);
                setSearchQuery('');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.closePickerText}>Cerrar Buscador</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 15 : 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  backBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
  backText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 20,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 20,
    marginBottom: 20,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  otNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusAbierta: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  statusProceso: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  statusEspera: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
  },
  statusCerrada: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  statusText: {
    fontWeight: 'bold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 5,
    fontWeight: '700',
  },
  valueHighlight: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#00bfff',
  },
  value: {
    fontSize: 15,
    color: '#e2e8f0',
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    flex: 1,
  },
  pmHeader: {
    flexDirection: 'column',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  pmBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  pmBadgeText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pmTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
    lineHeight: 20,
  },
  checklistContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  checklistHeader: {
    backgroundColor: 'rgba(0, 191, 255, 0.06)',
    padding: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  checklistHeaderText: {
    color: '#00bfff',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkIcon: {
    color: '#0a0f1d',
    fontSize: 13,
    fontWeight: 'bold',
  },
  taskText: {
    flex: 1,
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  taskTextChecked: {
    color: '#64748b',
    textDecorationLine: 'line-through',
  },
  cardReadonly: {
    backgroundColor: 'rgba(16, 185, 129, 0.02)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#10b981',
    marginBottom: 20,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  readonlyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#10b981',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  valueReadonly: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 18,
  },
  formLabel: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 6,
  },
  selectorButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  inactiveButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  selectedAbierta: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: '#ef4444',
  },
  selectedProceso: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: '#f59e0b',
  },
  selectedEspera: {
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
    borderColor: '#eab308',
  },
  selectedCerrada: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: '#10b981',
  },
  selectorIcon: {
    fontSize: 15,
    marginBottom: 4,
  },
  selectorButtonText: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#ffffff',
  },
  inputReadonly: {
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    color: '#64748b',
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  calculatedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  calculatedBadgeText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: 'bold',
  },
  timeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeBreakdownCard: {
    marginTop: 10,
    padding: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderLeftWidth: 3,
    borderColor: '#10b981',
    borderRadius: 8,
  },
  timeBreakdownLine: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  boldText: {
    fontWeight: '700',
    color: '#cbd5e1',
  },
  timeBreakdownTotal: {
    marginTop: 6,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingTop: 8,
  },
  timeTotalText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#10b981',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  formActions: {
    marginTop: 10,
  },
  btnSubmit: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  btnSubmitCierre: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
  },
  btnSubmitProgreso: {
    backgroundColor: '#00bfff',
    shadowColor: '#00bfff',
  },
  btnSubmitText: {
    color: '#0a0f1d',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  materialsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  costBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  costBadgeText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: 'bold',
  },
  btnAddMaterial: {
    backgroundColor: 'rgba(0, 191, 255, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 191, 255, 0.25)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  btnAddMaterialText: {
    color: '#00bfff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  materialForm: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderWidth: 1.5,
    borderColor: '#00bfff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  materialFormTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00bfff',
    marginBottom: 12,
  },
  materialSelectBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 14,
  },
  materialSelectBtnText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  formRowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
    gap: 10,
  },
  formActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnCancelMat: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  btnCancelMatText: {
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  btnSaveMat: {
    backgroundColor: '#00bfff',
  },
  btnSaveMatText: {
    color: '#0a0f1d',
    fontWeight: 'bold',
  },
  emptyMaterials: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyMaterialsText: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
  },
  materialsList: {
    gap: 12,
  },
  materialItem: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 14,
  },
  materialItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  materialItemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  btnDeleteMat: {
    padding: 4,
  },
  btnDeleteMatText: {
    fontSize: 14,
  },
  materialItemMeta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  qtyBadge: {
    backgroundColor: 'rgba(0, 191, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  qtyBadgeText: {
    color: '#00bfff',
    fontSize: 11,
    fontWeight: '700',
  },
  costItemBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  costItemBadgeText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  materialItemNotes: {
    marginTop: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  materialItemNotesText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,15,29,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  pickerContent: {
    backgroundColor: '#0a0f1d',
    borderColor: 'rgba(0, 191, 255, 0.3)',
    borderWidth: 1.5,
    borderRadius: 24,
    width: '90%',
    maxHeight: '80%',
    padding: 24,
    elevation: 10,
    shadowColor: '#00bfff',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
    textAlign: 'center',
  },
  searchInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    color: '#ffffff',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    marginBottom: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pickerScroll: {
    flexGrow: 0,
  },
  pickerItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  pickerItemText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  pickerItemSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  closePickerBtn: {
    marginTop: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closePickerText: {
    fontWeight: 'bold',
    color: '#ffffff',
    fontSize: 14,
  }
});
