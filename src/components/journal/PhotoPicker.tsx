/**
 * PhotoPicker Component
 *
 * - Supports camera + gallery via react-native-image-picker
 * - Max 5 photos enforced
 * - Shows selected thumbnails with drag-to-reorder (DraggableFlatList)
 * - Deletes on long-press
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
  MediaType,
} from 'react-native-image-picker';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { useTheme } from '@/theme/ThemeContext';
import { JournalPhoto } from '@/types';
import { spacing, radius } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const MAX_PHOTOS = 5;
const THUMB_SIZE = 90;

interface PhotoPickerProps {
  photos: JournalPhoto[];
  onPhotosChange: (photos: JournalPhoto[]) => void;
  onPhotoAdded: (photo: JournalPhoto) => void;
}

export const PhotoPicker: React.FC<PhotoPickerProps> = ({
  photos,
  onPhotosChange,
  onPhotoAdded,
}) => {
  const { theme } = useTheme();

  const pickFromGallery = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }

    launchImageLibrary(
      { mediaType: 'photo' as MediaType, quality: 0.8, selectionLimit: MAX_PHOTOS - photos.length },
      handlePickerResponse,
    );
  }, [photos.length]);

  const pickFromCamera = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }

    launchCamera(
      { mediaType: 'photo' as MediaType, quality: 0.8, saveToPhotos: false },
      handlePickerResponse,
    );
  }, [photos.length]);

  const handlePickerResponse = (response: ImagePickerResponse) => {
    if (response.didCancel || response.errorCode) return;

    const newPhotos: JournalPhoto[] = (response.assets ?? []).map((asset, i) => {
      const photo: JournalPhoto = {
        id: `photo_${Date.now()}_${i}`,
        uri: asset.uri!,
        tags: [],
        taggingStatus: 'pending',
        order: photos.length + i,
        createdAt: new Date().toISOString(),
      };
      onPhotoAdded(photo);
      return photo;
    });

    onPhotosChange([...photos, ...newPhotos].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (id: string) => {
    Alert.alert('Remove Photo', 'Remove this photo from the entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          const updated = photos
            .filter(p => p.id !== id)
            .map((p, i) => ({ ...p, order: i }));
          onPhotosChange(updated);
        },
      },
    ]);
  };

  const showSourcePicker = () => {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: pickFromCamera },
      { text: 'Gallery', onPress: pickFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderPhoto = ({ item, drag, isActive }: RenderItemParams<JournalPhoto>) => (
    <ScaleDecorator>
      <TouchableOpacity
        onLongPress={drag}
        onPress={() => removePhoto(item.id)}
        style={[
          styles.thumb,
          { opacity: isActive ? 0.7 : 1 },
        ]}>
        <Image source={{ uri: item.uri }} style={styles.thumbImage} />
        <View style={styles.removeOverlay}>
          <Text style={styles.removeIcon}>✕</Text>
        </View>
        {item.taggingStatus === 'processing' && (
          <View style={styles.taggingOverlay}>
            <Text style={styles.taggingText}>AI...</Text>
          </View>
        )}
        {item.tags.length > 0 && (
          <View style={styles.tagsOverlay}>
            <Text style={styles.tagsText} numberOfLines={1}>
              #{item.tags[0]}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </ScaleDecorator>
  );

  const handleDragEnd = ({ data }: { data: JournalPhoto[] }) => {
    onPhotosChange(data.map((p, i) => ({ ...p, order: i })));
  };

  return (
    <View>
      <View style={styles.header}>
        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
          Photos ({photos.length}/{MAX_PHOTOS})
        </Text>
        {photos.length < MAX_PHOTOS && (
          <TouchableOpacity onPress={showSourcePicker} style={[styles.addBtn, { borderColor: theme.colors.primary }]}>
            <Text style={[styles.addBtnText, { color: theme.colors.primary }]}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {photos.length > 0 && (
        <DraggableFlatList
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={item => item.id}
          onDragEnd={handleDragEnd}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoList}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  addBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  addBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semiBold,
  },
  photoList: {
    paddingBottom: spacing[1],
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.md,
    marginRight: spacing[2],
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  removeOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIcon: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  taggingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(79,108,247,0.7)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  taggingText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  tagsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  tagsText: {
    color: '#fff',
    fontSize: 9,
  },
});
