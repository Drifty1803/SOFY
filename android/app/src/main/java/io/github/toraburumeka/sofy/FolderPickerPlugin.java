package io.github.toraburumeka.sofy;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "FolderPicker")
public class FolderPickerPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    
    private Uri pendingTreeUri = null;
    private String pendingFolderName = null;

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "pickFolderResult");
    }
    
    @PluginMethod
    public void scanPendingFolder(PluginCall call) {
        if (pendingTreeUri == null) {
            call.reject("No pending folder");
            return;
        }
        
        final Uri treeUri = pendingTreeUri;
        final String folderName = pendingFolderName;
        
        pendingTreeUri = null;
        pendingFolderName = null;
        
        executor.execute(() -> {
            try {
                DocumentFile pickedDir = DocumentFile.fromTreeUri(getContext(), treeUri);
                
                if (pickedDir == null) {
                    call.reject("Cannot read directory");
                    return;
                }
                
                DocumentFile[] files = pickedDir.listFiles();
                int totalFiles = files.length;

                JSObject startData = new JSObject();
                startData.put("folderName", folderName);
                startData.put("total", totalFiles);
                startData.put("current", 0);
                startData.put("percent", 0);
                notifyListeners("scanProgress", startData);
                
                JSArray filesArray = new JSArray();
                int lastReportedPercent = -1;
                
                for (int i = 0; i < totalFiles; i++) {
                    DocumentFile file = files[i];
                    
                    if (file.isFile()) {
                        String name = file.getName();
                        String uri = file.getUri().toString();
                        
                        JSObject fileObj = new JSObject();
                        fileObj.put("name", name);
                        fileObj.put("uri", uri);
                        fileObj.put("type", file.getType());
                        fileObj.put("size", file.length());
                        
                        filesArray.put(fileObj);
                    }

                    int percent = (int) ((i + 1) * 100 / totalFiles);
                    if (percent >= lastReportedPercent + 5 || (i + 1) % 10 == 0 || i == totalFiles - 1) {
                        lastReportedPercent = percent;
                        
                        JSObject progressData = new JSObject();
                        progressData.put("folderName", folderName);
                        progressData.put("total", totalFiles);
                        progressData.put("current", i + 1);
                        progressData.put("percent", percent);
                        notifyListeners("scanProgress", progressData);
                    }
                }
                
                JSObject ret = new JSObject();
                ret.put("folderName", folderName);
                ret.put("files", filesArray);
                call.resolve(ret);
                
            } catch (Exception e) {
                call.reject("Scan failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void copyContentFile(PluginCall call) {
        String sourceUri = call.getString("uri");
        String destName = call.getString("fileName");

        if (sourceUri == null || destName == null) {
            call.reject("Invalid arguments");
            return;
        }

        executor.execute(() -> {
            try {
                Uri uri = Uri.parse(sourceUri);
                InputStream is = getContext().getContentResolver().openInputStream(uri);
                
                File destFile = new File(getContext().getFilesDir(), destName);
                if (destFile.exists()) destFile.delete();
                
                OutputStream os = new FileOutputStream(destFile);
                
                byte[] buffer = new byte[8192];
                int length;
                while ((length = is.read(buffer)) > 0) {
                    os.write(buffer, 0, length);
                }
                
                os.flush();
                os.close();
                is.close();
                
                JSObject ret = new JSObject();
                ret.put("path", destFile.getAbsolutePath());
                ret.put("uri", "file://" + destFile.getAbsolutePath()); 
                call.resolve(ret);
                
            } catch (Exception e) {
                call.reject("Copy failed: " + e.getMessage());
            }
        });
    }

    @ActivityCallback
    private void pickFolderResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Uri treeUri = result.getData().getData();
            if (treeUri != null) {
                getContext().getContentResolver().takePersistableUriPermission(treeUri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);

                DocumentFile pickedDir = DocumentFile.fromTreeUri(getContext(), treeUri);
                
                if (pickedDir == null) {
                    call.reject("Cannot read directory");
                    return;
                }

                pendingTreeUri = treeUri;
                pendingFolderName = pickedDir.getName();
                
                JSObject ret = new JSObject();
                ret.put("folderName", pendingFolderName);
                ret.put("pending", true);
                call.resolve(ret);
                
            } else {
                call.reject("No folder selected");
            }
        } else {
            call.reject("Canceled");
        }
    }
    
    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        executor.shutdown();
    }
}