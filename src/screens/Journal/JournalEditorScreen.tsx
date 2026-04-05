/**
 * JournalEditorScreen — Create & Edit
 *
 * Flow:
 *  1. Mount → fetch geolocation in background
 *  2. User fills title, description, picks photos
 *  3. Each photo added → trigger AI tagging (online) or queue (offline)
 *  4. Save → upsertEntry + enqueue sync
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { JournalStackParamList, JournalEntry, JournalPhoto, Coordinates } from '@/types';
import { TextInput } from '@/components/ui/TextInput';
import { Button } from '@/components/ui/Button';
import { PhotoPicker } from '@/components/journal/PhotoPicker';
import { TagChip } from '@/components/ui/TagChip';
import { useTheme } from '@/theme/ThemeContext';
import { useJournalStore } from '@/store/journalStore';
import { useAuthStore } from '@/store/authStore';
import { useSyncStore } from '@/store/syncStore';
import { fetchLocationWithName, requestLocationPermission } from '@/services/geoService';
import { processPhoto } from '@/services/aiTaggingService';
import { enqueueEntrySync } from '@/services/syncService';
import { generateId } from '@/utils/generateId';
import { toISO } from '@/utils/dateUtils';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Nav = NativeStackNavigationProp<JournalStackParamList, 'JournalEditor'>;
type Route = RouteProp<JournalStackParamList, 'JournalEditor'>;

export const JournalEditorScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { entryId } = route.params ?? {};
  const isEdit = Boolean(entryId);

  const { saveEntry, activeEntry, loadEntry } = useJournalStore();
  const user = useAuthStore(state => state.user);
  const { isOnline } = useSyncStore();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<JournalPhoto[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [manualTag, setManualTag] = useState('');
  const [location, setLocation] = useState<Coordinates | undefined>();
  const [locationName, setLocationName] = useState('');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ title?: string }>({});

  const entryIdRef = useRef(entryId ?? generateId());

  // Load existing entry for edit
  useEffect(() => {
    if (isEdit && entryId) {
      loadEntry(entryId).then(() => {
        if (activeEntry) {
          setTitle(activeEntry.title);
          setDescription(activeEntry.description);
          setPhotos(activeEntry.photos);
          setTags(activeEntry.tags);
          setLocation(activeEntry.location);
          setLocationName(activeEntry.locationName ?? '');
        }
      });
    }
  }, [isEdit, entryId]);

  // Auto-fetch location on mount
  useEffect(() => {
    if (!isEdit) {
      fetchLocation();
    }
  }, []);

  const fetchLocation = async () => {
    setIsFetchingLocation(true);
    const permitted = await requestLocationPermission();
    if (!permitted) {
      setIsFetchingLocation(false);
      return;
    }
    try {
      const { coordinates, locationName: name } = await fetchLocationWithName();
      setLocation(coordinates);
      setLocationName(name);
    } catch {
      // Location unavailable — not critical
    } finally {
      setIsFetchingLocation(false);
    }
  };

  // Called when a new photo is selected — triggers AI tagging (both providers)
  const handlePhotoAdded = useCallback(
    async (photo: JournalPhoto) => {
      const result = await processPhoto({
        photoId: photo.id,
        entryId: entryIdRef.current,
        localUri: photo.uri,
        isOnline,
      });

      const { mergedTags, openAITags, googleTags, openAIError, googleError } = result;

      if (mergedTags.length > 0) {
        setTags(prev => [...new Set([...prev, ...mergedTags])]);
        setPhotos(prev =>
          prev.map(p =>
            p.id === photo.id ? { ...p, tags: mergedTags, taggingStatus: 'done' } : p,
          ),
        );
      }


    },
    [isOnline],
  );

  const addManualTag = () => {
    const t = manualTag.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !tags.includes(t)) {
      setTags(prev => [...prev, t]);
    }
    setManualTag('');
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  const validate = (): boolean => {
    if (!title.trim()) {
      setErrors({ title: 'Title is required' });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSave = async () => {
    console.log('DEBUG: handleSave started');
    const isValid = validate();
    // Fallback: if 'user' from hook is null, try direct store state (bypass potential closure issues)
    const currentUser = user || useAuthStore.getState().user;
    
    console.log('DEBUG: validate results:', isValid, { 
      storeId: useAuthStore.getState().storeId,
      titleLength: title.trim().length, 
      hasUserHook: !!user,
      hasUserStore: !!useAuthStore.getState().user
    });
    
    if (!isValid || !currentUser) {
      if (!currentUser) {
        console.warn('DEBUG: Save aborted \u2014 user is null in hook and store');
        Alert.alert('Authentication Error', 'Please log in again to save your journal.');
      }
      return;
    }
    
    setIsSaving(true);
    console.log('DEBUG: isSaving set to true, preparing entry object');

    const now = toISO();
    const entry: JournalEntry = {
      id: entryIdRef.current,
      userId: currentUser.id,
      title: title.trim(),
      description: description.trim(),
      photos,
      tags,
      location,
      locationName: locationName || undefined,
      createdAt: isEdit ? (activeEntry?.createdAt ?? now) : now,
      updatedAt: now,
      syncStatus: 'local',
      isDeleted: false,
    };
    
    console.log('DEBUG: entry object ready:', { id: entry.id, photosCount: entry.photos.length });

    try {
      console.log('DEBUG: calling saveEntry...');
      await saveEntry(entry);
      console.log('DEBUG: saveEntry successful, calling enqueueEntrySync...');
      await enqueueEntrySync(entry, isEdit ? 'update' : 'create');
      console.log('DEBUG: enqueueEntrySync successful, navigating back');
      navigation.goBack();
    } catch (e) {
      console.error('DEBUG: Save Action Error:', e);
      Alert.alert('Save Failed', String(e));
    } finally {
      console.log('DEBUG: Finally block — setting isSaving to false');
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Nav header */}
        <View style={[styles.navHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.navBtn, { color: theme.colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: theme.colors.text }]}>
            {isEdit ? 'Edit Entry' : 'New Entry'}
          </Text>
          <Button
            label="Save"
            onPress={handleSave}
            isLoading={isSaving}
            size="sm"
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Location */}
          <View style={[styles.locationBar, { backgroundColor: theme.colors.inputBackground }]}>
            {isFetchingLocation ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Text style={[styles.locationText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                📍 {locationName || 'Location unavailable'}
              </Text>
            )}
            <TouchableOpacity onPress={fetchLocation}>
              <Text style={[styles.refreshLocation, { color: theme.colors.primary }]}>
                {isFetchingLocation ? '' : '↻'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <TextInput
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Where did you go?"
            error={errors.title}
            containerStyle={styles.field}
            returnKeyType="next"
          />

          {/* Description */}
          <TextInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What happened? How did it feel?"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            containerStyle={styles.field}
            style={styles.textarea}
          />

          {/* Photos */}
          <View style={styles.field}>
            <PhotoPicker
              photos={photos}
              onPhotosChange={setPhotos}
              onPhotoAdded={handlePhotoAdded}
            />
          </View>

          {/* Tags */}
          <View style={styles.field}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Tags</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                value={manualTag}
                onChangeText={setManualTag}
                placeholder="Add tag..."
                returnKeyType="done"
                onSubmitEditing={addManualTag}
                containerStyle={styles.tagInput}
              />
              <TouchableOpacity
                onPress={addManualTag}
                style={[styles.tagAddBtn, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.tagAddIcon}>+</Text>
              </TouchableOpacity>
            </View>
            {tags.length > 0 && (
              <View style={styles.tagsRow}>
                {tags.map(tag => (
                  <TagChip key={tag} label={tag} onRemove={() => removeTag(tag)} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn: { fontSize: typography.sizes.base },
  navTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[16],
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    marginBottom: spacing[4],
  },
  locationText: {
    flex: 1,
    fontSize: typography.sizes.sm,
  },
  refreshLocation: {
    fontSize: 20,
    marginLeft: spacing[2],
  },
  field: {
    marginBottom: spacing[5],
  },
  textarea: {
    minHeight: 120,
    paddingTop: spacing[3],
  },
  sectionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginBottom: spacing[2],
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  tagInput: {
    flex: 1,
  },
  tagAddBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagAddIcon: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing[3],
  },
});
