package com.staykids.parent;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.CallLog;
import android.provider.Telephony;
import androidx.core.content.ContextCompat;
import org.json.JSONArray;
import org.json.JSONObject;

public class CallSmsReader {
    public static JSONArray getCallLogs(Context context) {
        JSONArray logs = new JSONArray();
        try {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED) {
                Cursor cursor = context.getContentResolver().query(
                    CallLog.Calls.CONTENT_URI, null, null, null, CallLog.Calls.DATE + " DESC LIMIT 50");
                if (cursor != null) {
                    try {
                        int numberCol = cursor.getColumnIndex(CallLog.Calls.NUMBER);
                        int nameCol = cursor.getColumnIndex(CallLog.Calls.CACHED_NAME);
                        int typeCol = cursor.getColumnIndex(CallLog.Calls.TYPE);
                        int dateCol = cursor.getColumnIndex(CallLog.Calls.DATE);
                        int durCol = cursor.getColumnIndex(CallLog.Calls.DURATION);
                        
                        while (cursor.moveToNext()) {
                            JSONObject logItem = new JSONObject();
                            logItem.put("id", "call_" + cursor.getString(dateCol));
                            logItem.put("logType", "CALL");
                            String contactName = (nameCol >= 0 && cursor.getString(nameCol) != null) ? cursor.getString(nameCol) : (numberCol >= 0 ? cursor.getString(numberCol) : "Unknown");
                            logItem.put("contact", contactName);
                            
                            int type = typeCol >= 0 ? cursor.getInt(typeCol) : -1;
                            String typeStr = type == CallLog.Calls.INCOMING_TYPE ? "Incoming" : (type == CallLog.Calls.OUTGOING_TYPE ? "Outgoing" : "Missed");
                            logItem.put("detail", typeStr + " (" + (durCol >= 0 ? cursor.getString(durCol) : "0") + "s)");
                            logItem.put("timestamp", cursor.getLong(dateCol));
                            logs.put(logItem);
                        }
                    } finally {
                        cursor.close();
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return logs;
    }

    public static JSONArray getSmsLogs(Context context) {
        JSONArray logs = new JSONArray();
        try {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED) {
                Cursor cursor = context.getContentResolver().query(
                    Telephony.Sms.CONTENT_URI, null, null, null, Telephony.Sms.DATE + " DESC LIMIT 50");
                if (cursor != null) {
                    try {
                        int addressCol = cursor.getColumnIndex(Telephony.Sms.ADDRESS);
                        int bodyCol = cursor.getColumnIndex(Telephony.Sms.BODY);
                        int dateCol = cursor.getColumnIndex(Telephony.Sms.DATE);
                        int typeCol = cursor.getColumnIndex(Telephony.Sms.TYPE);
                        
                        while (cursor.moveToNext()) {
                            JSONObject logItem = new JSONObject();
                            logItem.put("id", "sms_" + cursor.getString(dateCol));
                            logItem.put("logType", "SMS");
                            logItem.put("contact", addressCol >= 0 ? cursor.getString(addressCol) : "Unknown");
                            String body = bodyCol >= 0 ? cursor.getString(bodyCol) : "";
                            if (body.length() > 50) body = body.substring(0, 47) + "...";
                            
                            int type = typeCol >= 0 ? cursor.getInt(typeCol) : -1;
                            String typeStr = type == Telephony.Sms.MESSAGE_TYPE_INBOX ? "Received" : "Sent";
                            logItem.put("detail", typeStr + ": " + body);
                            logItem.put("timestamp", cursor.getLong(dateCol));
                            logs.put(logItem);
                        }
                    } finally {
                        cursor.close();
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return logs;
    }
}
